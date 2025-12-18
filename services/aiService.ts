import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  return str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
}

async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  const key = (window as any).process?.env?.API_KEY || (process as any).env?.API_KEY || "";
  if (!key) throw new Error("API Key 未设置，请检查环境变量。");

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
        temperature: params.temperature ?? 0.3,
        // 强制要求 JSON 时，确保 systemInstruction 包含 JSON 字样
        response_format: params.responseMimeType === "application/json" ? { type: "json_object" } : undefined
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
  const systemInstruction = `你是一位顶尖技术猎头。任务：从简历提取 JSON 画像。必须包含核心领域、资历、技能标签。`;

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
      coreDomain: data.coreDomain || "通用领域",
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

  const systemInstruction = `匹配简历与岗位，返回 JSON 数组格式。`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历: ${JSON.stringify(resume)}\n职位库: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
      responseMimeType: "application/json",
      temperature: 0.5
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
  // 增加单段文本长度，减少请求次数
  const chunkSize = 15000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) chunks.push(rawText.slice(i, i + chunkSize));

  let allJobs: any[] = [];
  const systemInstruction = `你是一个精准的招聘数据提取助手。
任务：从文本（包含链接、公司名、地点、职位名，常用 | 分隔）中提取结构化岗位。
要求：
1. 必须返回 JSON 格式。格式必须是包含岗位的数组：[{"company": "...", "title": "...", "location": "...", "link": "..."}]。
2. 即使数据不全也要尽量提取。微信公众号链接（mp.weixin.qq.com）通常是 link 字段。
3. 如果该段落没找到任何岗位，返回空数组 []。`;

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `请提取以下文本中的招聘岗位：\n${chunks[i]}`,
        responseMimeType: "application/json",
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text || "[]");
      let data = JSON.parse(cleaned);
      
      // 容错处理：如果 AI 返回的是 { "jobs": [...] } 而不是数组
      if (data && !Array.isArray(data) && data.jobs) {
        data = data.jobs;
      }
      
      if (Array.isArray(data)) {
        allJobs = [...allJobs, ...data];
      }
    } catch (e: any) {
      console.warn(`第 ${i+1} 段解析异常:`, e.message);
    }
  }
  return allJobs;
};