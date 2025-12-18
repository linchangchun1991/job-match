import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  return str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
}

/**
 * 核心解析函数 - 猎头 & ATS 专家
 */
export const parseResume = async (text: string): Promise<ParsedResume> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const currentDate = new Date().toISOString().split('T')[0];
  
  const systemInstruction = `你是一位拥有 10 年经验的顶尖技术猎头和 ATS 解析专家。
任务：从简历文本中提取核心价值，必须严格返回 JSON 格式。

JSON 结构：
{
  "name": "姓名",
  "phone": "电话",
  "email": "邮箱",
  "education": "最高学历",
  "university": "毕业院校",
  "major": "专业",
  "graduationYear": "年份",
  "graduationDate": "YYYY.MM",
  "isFreshGrad": true/false,
  "workYears": 0,
  "expectedCities": ["城市"],
  "skills": ["技能1", "技能2"],
  "experience": "经历总结",
  "jobPreference": "意向岗位",
  "coreDomain": "核心领域",
  "seniorityLevel": "资历评估",
  "coreTags": ["标签1", "标签2"],
  "atsScore": 85,
  "atsDimensions": { "education": 80, "skills": 85, "project": 90, "internship": 80, "quality": 85 },
  "atsAnalysis": "AI诊断优化建议"
}`;

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
  } catch (e) {
    console.error("Parse Resume Error:", e);
    throw new Error("简历解析失败：无法获取 API Key 或服务器无响应。");
  }
};

/**
 * 增强版匹配函数 - 追求广度与多样性
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // 增加匹配池到 150 以获取更多可能性
  const validJobs = jobs.filter(j => j.company && j.title).slice(0, 150); 
  if (validJobs.length === 0) return [];

  // 注入随机因子
  const randomSalt = Math.random().toString(36).substring(7);

  const systemInstruction = `你是一位顶级职业规划师与资深猎头。
任务：根据候选人简历，从库中深度挖掘【至少 20-30 个】适配岗位。

要求：
1. 多样性：不要局限于单一岗位名称，进行语义关联（如 React 开发者可匹配前端岗、全栈岗）。
2. 随机探索：每次匹配请尝试从不同角度切入，推荐一些具有挑战性或跨行业的潜力岗位。
3. 教练金句：为每个岗位生成一句富有人格魅力的“顶级教练推荐语”，用于指导投递。
4. 必须返回 JSON: { "matches": [{ "i": 索引, "s": 匹配分(60-100), "reasons": ["理由"], "coach_advice": "推荐金句" }] }`;

  const userPrompt = `
随机标识符: ${randomSalt}
候选人：${resume.name} | 技能：${resume.skills.join(', ')} | 意向：${resume.jobPreference}
职位库：${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title, l: j.location })))}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.95, // 极高随机性确保每次上传结果不同
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const cleaned = stripMarkdown(response.text || '');
    const parsed = JSON.parse(cleaned);
    const list = parsed.matches || [];

    const results = list.map((m: any) => {
      const job = validJobs[m.i];
      if (!job) return null;
      return {
        jobId: job.id,
        score: m.s,
        matchReasons: m.reasons || [],
        mismatchReasons: [],
        recommendation: m.coach_advice || '作为你的职业教练，我非常看好这个机会，它的底层架构非常适合你的技术成长。',
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chunkSize = 10000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) chunks.push(rawText.slice(i, i + chunkSize));

  let allJobs: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `提取 JSON 岗位数组：\n${chunks[i]}`,
        config: { 
          systemInstruction: "提取 company, title, location, link。返回 JSON。",
          responseMimeType: "application/json"
        }
      });
      const data = JSON.parse(stripMarkdown(response.text));
      if (Array.isArray(data)) allJobs = [...allJobs, ...data];
    } catch (e) {}
  }
  return allJobs;
};