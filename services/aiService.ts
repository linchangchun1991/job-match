
import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * Strips markdown code blocks from a string to extract JSON content.
 */
function stripMarkdown(str: string): string {
  if (!str) return "";
  let cleaned = str.replace(/```(json)?/g, '').replace(/```/g, '').trim();
  
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  let startIndex = -1;
  
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIndex = firstBracket;
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  }

  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  let endIndex = -1;
  
  if (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) {
    endIndex = lastBracket;
  } else if (lastBrace !== -1) {
    endIndex = lastBrace;
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return cleaned.substring(startIndex, endIndex + 1);
  }
  return cleaned;
}

/**
 * Calls Gemini API using @google/genai SDK.
 */
async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  // Use the process.env.API_KEY string directly when initializing the @google/genai client instance.
  // Instantiating right before call as per guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: params.prompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature ?? 0.1,
      responseMimeType: "application/json",
    },
  });

  // response.text returns the extracted string output.
  return { text: response.text || '' };
}

export const parseResume = async (text: string): Promise<ParsedResume> => {
  const systemInstruction = `你是一位顶级 HR 专家。请从简历文本中提取 JSON 画像。必须严格包含字段：coreDomain, seniorityLevel, coreTags, atsDimensions, atsAnalysis, atsScore, name, phone, email, education, university, major, graduationYear, graduationDate, isFreshGrad, workYears, expectedCities, skills, experience, jobPreference。`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历内容：\n${text.slice(0, 8000)}`,
      temperature: 0.1
    });

    const data = JSON.parse(stripMarkdown(res.text || '{}'));
    return {
      ...data,
      coreDomain: data.coreDomain || "行业精英",
      seniorityLevel: data.seniorityLevel || "待评估",
      coreTags: data.coreTags || [],
      tags: data.tags || { degree: [], exp: [], skill: [], intent: [] },
      atsDimensions: data.atsDimensions || { education: 60, skills: 60, project: 60, internship: 60, quality: 60 },
      atsScore: data.atsScore || 70
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

  const systemInstruction = `你是职业教练，匹配简历与职位。返回 JSON：{ "matches": [{ "i": 索引, "s": 匹配度分数(0-100), "reasons": [原因列表], "coach_advice": "教练给求职者的金句" }] }`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历画像: ${JSON.stringify(resume)}\n待匹配库: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
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
        recommendation: m.coach_advice || '该岗位与您的背景高度契合，建议立即投递。',
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
  const chunkSize = 3000; 
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) {
    chunks.push(rawText.slice(i, i + chunkSize));
  }

  let allJobs: any[] = [];
  const systemInstruction = `你是一个精准的招聘数据提取机器人。
输入文本格式：行业 | 公司 | 岗位列表 | 地点 | 链接 | 补充信息。
任务：
1. 识别每一行招聘信息。
2. 强制逻辑：第3列的“岗位列表”若包含多个职位（逗号、顿号、空格分隔），必须拆分为多个独立的 JSON 对象。
3. 必须输出包含 "jobs" 数组的 JSON 对象。
结构：{"jobs": [{"company": "公司", "title": "单一岗位名", "location": "地点", "link": "链接"}]}

示例：
输入："游戏 | 4399 | 产品类，技术类 | 广州 | https://link"
输出：{"jobs": [{"company": "4399", "title": "产品类", "location": "广州", "link": "https://link"}, {"company": "4399", "title": "技术类", "location": "广州", "link": "https://link"}]}

忽略任何无法解析的杂质行。`;

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `请提取并拆分以下招聘文本中的岗位：\n${chunks[i]}`,
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text || '{"jobs":[]}');
      const data = JSON.parse(cleaned);
      
      const jobsInChunk = data.jobs || (Array.isArray(data) ? data : []);
      if (Array.isArray(jobsInChunk)) {
        allJobs = [...allJobs, ...jobsInChunk];
      }
    } catch (e: any) {
      console.warn(`[解析警告] 段落 ${i+1}/${chunks.length} 解析中断:`, e.message);
    }
  }
  return allJobs;
};
