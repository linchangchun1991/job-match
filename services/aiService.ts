import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  let cleaned = str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
  // 移除可能存在的 JSON 数组外的解释性文字
  const startIndex = cleaned.indexOf('[');
  const endIndex = cleaned.lastIndexOf(']');
  if (startIndex !== -1 && endIndex !== -1) {
    cleaned = cleaned.substring(startIndex, endIndex + 1);
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
  if (!key) throw new Error("API Key 未设置，请在 index.html 或设置中检查。");

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
        temperature: params.temperature ?? 0.1, // 降低随机性，提高稳定性
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
  const systemInstruction = `你是一位求职专家。从简历中提取 JSON。必须包含 coreDomain, seniorityLevel, coreTags, atsDimensions, atsAnalysis。`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `日期：${currentDate}\n简历：\n${text.slice(0, 10000)}`,
      responseMimeType: "application/json",
      temperature: 0.1
    });

    const data = JSON.parse(stripMarkdown(res.text || '{}'));
    return {
      ...data,
      coreDomain: data.coreDomain || "职场新人",
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

  const systemInstruction = `匹配简历与岗位，返回 JSON: { "matches": [{ "i": 索引, "s": 分数, "reasons": [], "coach_advice": "" }] }`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历: ${JSON.stringify(resume)}\n职位: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
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
  const chunkSize = 12000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) chunks.push(rawText.slice(i, i + chunkSize));

  let allJobs: any[] = [];
  const systemInstruction = `你是一个精准的招聘数据提取专家。
输入格式通常为：行业 | 公司 | 岗位列表 | 地点 | 链接 | 其他。
任务：
1. 识别每一行的数据。
2. 重要：如果“岗位列表”中包含多个岗位（用逗号、空格或顿号分隔），请将其拆分成多个独立的对象。
3. 必须返回 JSON 格式，包含一个名为 "jobs" 的数组。
4. 结构：{"jobs": [{"company": "公司名", "title": "单体岗位名", "location": "地点", "link": "链接"}]}。
5. 忽略空行或无关文字。`;

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `请提取以下招聘数据并拆分岗位：\n${chunks[i]}`,
        responseMimeType: "application/json",
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text || '{"jobs":[]}');
      const data = JSON.parse(cleaned);
      
      const jobsInChunk = Array.isArray(data) ? data : (data.jobs || []);
      if (Array.isArray(jobsInChunk)) {
        allJobs = [...allJobs, ...jobsInChunk];
      }
    } catch (e: any) {
      console.warn(`段落 ${i+1} 解析异常:`, e.message);
    }
  }
  return allJobs;
};