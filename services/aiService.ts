import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  return str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
}

/**
 * 安全获取 API Key 的工具函数
 */
const getApiKey = (): string => {
  // 优先从全局 process.env 获取（Zeabur/Vite 注入）
  const key = (window as any).process?.env?.API_KEY || (process as any).env?.API_KEY;
  if (!key) {
    console.error("Gemini API Key is missing in environment.");
  }
  return key || "";
};

/**
 * 核心解析函数 - 猎头 & ATS 专家
 */
export const parseResume = async (text: string): Promise<ParsedResume> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("未检测到 API Key，请在设置中配置或检查环境变量。");
  
  const ai = new GoogleGenAI({ apiKey });
  const currentDate = new Date().toISOString().split('T')[0];
  
  const systemInstruction = `你是一位拥有 10 年经验的顶尖技术猎头和 ATS 解析专家。
任务：从简历文本中提取核心价值，必须严格返回 JSON 格式。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `当前日期：${currentDate}\n简历内容：\n${text.slice(0, 10000)}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const cleaned = stripMarkdown(response.text || '');
    const data = JSON.parse(cleaned);
    
    return {
      ...data,
      coreDomain: data.coreDomain || "未识别领域",
      seniorityLevel: data.seniorityLevel || "未识别资历",
      coreTags: data.coreTags || [],
      tags: data.tags || { degree: [], exp: [], skill: [], intent: [] },
      atsDimensions: data.atsDimensions || { education: 60, skills: 60, project: 60, internship: 60, quality: 60 }
    };
  } catch (e: any) {
    console.error("Parse Resume Error:", e);
    throw new Error(`简历解析失败: ${e.message || "未知 API 错误"}`);
  }
};

/**
 * 增强版匹配函数
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return [];
  
  const ai = new GoogleGenAI({ apiKey });
  const validJobs = jobs.filter(j => j.company && j.title).slice(0, 150); 
  if (validJobs.length === 0) return [];

  const randomSalt = Math.random().toString(36).substring(7);

  const systemInstruction = `你是一位顶级职业规划师与资深猎头。任务：根据候选人简历适配岗位。必须返回 JSON: { "matches": [{ "i": 索引, "s": 匹配分(60-100), "reasons": ["理由"], "coach_advice": "推荐金句" }] }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `随机标识: ${randomSalt}\n简历信息: ${JSON.stringify(resume)}\n职位库: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.95
      }
    });

    const cleaned = stripMarkdown(response.text || '');
    const parsed = JSON.parse(cleaned);
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key 未设置，请在环境变量或代码中配置。");
  
  const ai = new GoogleGenAI({ apiKey });
  const chunkSize = 10000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) chunks.push(rawText.slice(i, i + chunkSize));

  let allJobs: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `提取岗位 JSON 数组：\n${chunks[i]}`,
        config: { 
          systemInstruction: "提取 company, title, location, link。返回 JSON 数组。",
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "";
      const data = JSON.parse(stripMarkdown(text));
      if (Array.isArray(data)) allJobs = [...allJobs, ...data];
    } catch (e) {
      console.warn("Chunk parsing failed:", e);
    }
  }
  return allJobs;
};