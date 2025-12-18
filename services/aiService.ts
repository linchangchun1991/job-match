import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  // 移除 markdown 代码块标识
  let cleaned = str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
  
  // 寻找第一个 [ 或 {
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  let startIndex = -1;
  
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIndex = firstBracket;
  } else {
    startIndex = firstBrace;
  }

  // 寻找最后一个 ] 或 }
  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  let endIndex = -1;
  
  if (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) {
    endIndex = lastBracket;
  } else {
    endIndex = lastBrace;
  }

  if (startIndex !== -1 && endIndex !== -1) {
    return cleaned.substring(startIndex, endIndex + 1);
  }
  return cleaned;
}

async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  const key = (window as any).process?.env?.API_KEY || (process as any).env?.API_KEY || "";
  if (!key) throw new Error("API Key 未设置，请检查 index.html。");

  if (key.startsWith('sk-')) {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: params.systemInstruction },
          { role: "user", content: params.prompt }
        ],
        temperature: params.temperature ?? 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`DeepSeek API 错误: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
  } 
  
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: params.prompt,
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: params.responseMimeType as any,
      temperature: params.temperature
    }
  });
  return { text: response.text };
}

export const parseResume = async (text: string): Promise<ParsedResume> => {
  const currentDate = new Date().toISOString().split('T')[0];
  const systemInstruction = `你是一位 HR 专家，请从简历文本中提取 JSON 画像。包含 coreDomain, seniorityLevel, coreTags, atsDimensions, atsAnalysis。`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `当前日期：${currentDate}\n简历内容：\n${text.slice(0, 10000)}`,
      responseMimeType: "application/json",
      temperature: 0.1
    });

    const data = JSON.parse(stripMarkdown(res.text || '{}'));
    return {
      ...data,
      coreDomain: data.coreDomain || "职场人",
      seniorityLevel: data.seniorityLevel || "待评估",
      coreTags: data.coreTags || [],
      tags: data.tags || { degree: [], exp: [], skill: [], intent: [] },
      atsDimensions: data.atsDimensions || { education: 60, skills: 60, project: 60, internship: 60, quality: 60 }
    };
  } catch (e: any) {
    throw new Error(`简历解析失败: ${e.message}`);
  }
};

export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const validJobs = jobs.slice(0, 100); 
  if (validJobs.length === 0) return [];

  const systemInstruction = `匹配简历与岗位，返回 JSON 格式：{ "matches": [{ "i": 索引, "s": 分数(0-100), "reasons": [原因], "coach_advice": "建议" }] }`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历画像: ${JSON.stringify(resume)}\n待匹配岗位: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
      responseMimeType: "application/json",
      temperature: 0.3
    });

    const parsed = JSON.parse(stripMarkdown(res.text || '{"matches":[]}'));
    const results = (parsed.matches || []).map((m: any) => {
      const job = validJobs[m.i];
      if (!job) return null;
      return {
        jobId: job.id,
        score: m.s,
        matchReasons: m.reasons || [],
        mismatchReasons: [],
        recommendation: m.coach_advice || '适配',
        tips: '',
        job: job
      };
    }).filter(Boolean);

    if (onProgress) onProgress(results);
    return results;
  } catch (e) {
    return [];
  }
};

export const parseSmartJobs = async (
  rawText: string, 
  onProgress?: (current: number, total: number) => void
): Promise<any[]> => {
  // 减小分段大小以提高 DeepSeek 稳定性
  const chunkSize = 8000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) chunks.push(rawText.slice(i, i + chunkSize));

  let allJobs: any[] = [];
  const systemInstruction = `你是一个数据转换机器人。将“|”分隔的招聘文本转换为 JSON 数组。
数据格式示例：
输入："游戏 | 4399 | 产品类，技术类 | 广州 | https://link"
输出：{"jobs": [{"company": "4399", "title": "产品类", "location": "广州", "link": "https://link"}, {"company": "4399", "title": "技术类", "location": "广州", "link": "https://link"}]}

规则：
1. 识别 "|" 符号，第2列是公司，第3列是岗位列表。
2. 必须将第3列中的多个岗位（用逗号、空格、顿号分隔）拆分为独立的 JSON 对象。
3. 必须返回规范的 JSON 格式，且包含 "jobs" 数组。
4. 过滤掉任何无法识别的杂乱文本。`;

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `请将以下文本转换为岗位 JSON 对象，注意拆分多个岗位：\n${chunks[i]}`,
        responseMimeType: "application/json",
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text || '{"jobs":[]}');
      const data = JSON.parse(cleaned);
      
      const jobsInChunk = data.jobs || (Array.isArray(data) ? data : []);
      if (Array.isArray(jobsInChunk)) {
        allJobs = [...allJobs, ...jobsInChunk];
      }
    } catch (e: any) {
      console.warn(`第 ${i+1} 段解析失败:`, e.message);
    }
  }
  return allJobs;
};