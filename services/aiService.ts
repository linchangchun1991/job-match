import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  return str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
}

/**
 * 自动识别并调用 AI 接口
 * 兼容 Gemini (AIza...) 和 DeepSeek (sk-...)
 */
async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  const key = (window as any).process?.env?.API_KEY || (process as any).env?.API_KEY || "";
  
  if (!key) throw new Error("API Key 未设置");

  // 如果是 DeepSeek Key (sk-开头)
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
        temperature: params.temperature ?? 0.7,
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
  
  // 否则默认使用 Gemini SDK
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
  const systemInstruction = `你是一位顶尖技术猎头专家。从简历中提取核心价值。必须严格返回 JSON 格式。`;

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
      coreDomain: data.coreDomain || "未识别领域",
      seniorityLevel: data.seniorityLevel || "未识别资历",
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
  const validJobs = jobs.filter(j => j.company && j.title).slice(0, 100); 
  if (validJobs.length === 0) return [];

  const systemInstruction = `你是一位职业规划师。根据简历适配岗位。必须返回 JSON: { "matches": [{ "i": 索引, "s": 匹配分(60-100), "reasons": ["理由"], "coach_advice": "推荐金句" }] }`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历信息: ${JSON.stringify(resume)}\n职位库: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
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
        recommendation: m.coach_advice || '推荐该岗位。',
        tips: '',
        job: job
      };
    }).filter(Boolean);

    if (onProgress) onProgress(results);
    return results;
  } catch (e) {
    console.error("Match Error:", e);
    return [];
  }
};

export const parseSmartJobs = async (
  rawText: string, 
  onProgress?: (current: number, total: number) => void
): Promise<any[]> => {
  const chunkSize = 8000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) chunks.push(rawText.slice(i, i + chunkSize));

  let allJobs: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const res = await callAI({
        systemInstruction: "你是一个数据清洗助手。将非结构化的文本提取为岗位信息。必须返回 JSON 数组格式，包含 company, title, location, link 字段。如果没有找到数据，返回空数组 []。",
        prompt: `请从以下文本中提取招聘信息：\n${chunks[i]}`,
        responseMimeType: "application/json",
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text || "[]");
      const data = JSON.parse(cleaned);
      if (Array.isArray(data)) {
        allJobs = [...allJobs, ...data];
      }
    } catch (e: any) {
      console.error(`分段 ${i+1} 解析失败:`, e);
      // 如果发生 API 错误，直接抛出，让用户知道 Key 是否有问题
      if (e.message.includes('API') || e.message.includes('Key')) throw e;
    }
  }
  return allJobs;
};