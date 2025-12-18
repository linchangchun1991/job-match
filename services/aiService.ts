
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
        temperature: 0.1 // 解析需要准确性
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
    throw new Error("简历解析失败，请检查网络或格式。");
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
  const validJobs = jobs.filter(j => j.company && j.title).slice(0, 200); 
  if (validJobs.length === 0) return [];

  // 注入随机因子
  const randomSalt = Math.random().toString(36).substring(7);

  const systemInstruction = `你是一位拥有10年经验的顶级职业规划师与资深猎头。
任务：根据候选人简历，从库中挖掘【至少 20-30 个】适配岗位。

匹配哲学：
1. 广度挖掘：不要只看职位名称，要看技能底层逻辑。如果他是React开发者，也可以推荐泛前端或全栈岗。
2. 推荐金句：为每个岗位写一句富有洞察力的“顶级教练推荐语”（约30字），点出候选人为什么该去，以及他的核心优势。
3. 容错率：只要有 50% 以上相关性即可列入名单，确保候选人有足够的选择。

返回 JSON 格式: 
{ 
  "matches": [
    { 
      "i": 岗位索引, 
      "s": 匹配分(60-100), 
      "reasons": ["理由"], 
      "coach_advice": "这一句顶级教练推荐语" 
    }
  ] 
}`;

  const userPrompt = `
随机校验码: ${randomSalt}
候选人：${resume.name} | 领域：${resume.coreDomain} | 资历：${resume.seniorityLevel} | 核心技能：${resume.skills.join(', ')}
职位库：${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title, l: j.location })))}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.9 // 提高随机性，确保每次上传有不同惊喜
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
        recommendation: m.coach_advice || '该岗位与你的职业发展路径高度契合，建议尝试。',
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
        contents: `解析岗位：\n${chunks[i]}`,
        config: { 
          systemInstruction: "提取 company, title, location, link。返回 JSON 数组。",
          responseMimeType: "application/json"
        }
      });
      const data = JSON.parse(stripMarkdown(response.text));
      if (Array.isArray(data)) allJobs = [...allJobs, ...data];
    } catch (e) {}
  }
  return allJobs;
};
