
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

// 初始化 Gemini 客户端
// 注意：API_KEY 将自动从全局注入的 process.env.API_KEY 获取
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 简历智能解析：使用 Gemini 3.0 结构化输出模式
 */
export const parseResume = async (text: string): Promise<ParsedResume> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `你是一位顶级求职猎头专家。请分析以下简历内容，并提取核心画像信息：\n\n${text.slice(0, 10000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
            education: { type: Type.STRING },
            university: { type: Type.STRING },
            major: { type: Type.STRING },
            graduationYear: { type: Type.STRING },
            coreDomain: { type: Type.STRING, description: "核心行业/职能领域" },
            seniorityLevel: { type: Type.STRING, description: "职级评估，如：应届、中级、资深" },
            coreTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            atsScore: { type: Type.NUMBER, description: "综合竞争力得分 0-100" },
            atsAnalysis: { type: Type.STRING, description: "专家诊断建议" },
            atsDimensions: {
              type: Type.OBJECT,
              properties: {
                education: { type: Type.NUMBER },
                skills: { type: Type.NUMBER },
                project: { type: Type.NUMBER },
                internship: { type: Type.NUMBER },
                quality: { type: Type.NUMBER }
              }
            }
          },
          required: ["name", "coreDomain", "atsScore", "atsDimensions"]
        }
      }
    });

    const data = JSON.parse(response.text);
    
    // 补全业务逻辑所需的其他字段
    return {
      ...data,
      isFreshGrad: true,
      workYears: 0,
      expectedCities: [],
      skills: data.coreTags || [],
      experience: "",
      jobPreference: data.coreDomain || "",
      tags: { degree: [], exp: [], skill: [], intent: [] }
    } as ParsedResume;
  } catch (e: any) {
    console.error("Gemini Parse Failed:", e);
    throw new Error(`智能解析失败: ${e.message || '网络连接异常'}`);
  }
};

/**
 * 岗位深度匹配
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  // 筛选前 100 个岗位进行高质量匹配
  const validJobs = jobs.slice(0, 100);
  if (validJobs.length === 0) return [];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        你是一位资深职业教练。请根据候选人画像，从岗位列表中选出最匹配的项。
        
        候选人画像：${JSON.stringify(resume)}
        岗位列表：${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  i: { type: Type.NUMBER, description: "岗位在列表中的索引" },
                  score: { type: Type.NUMBER },
                  recommendation: { type: Type.STRING, description: "一句话推荐金句" }
                }
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text);
    const results = (parsed.matches || []).map((m: any) => {
      const job = validJobs[m.i];
      if (!job) return null;
      return {
        jobId: job.id,
        score: m.score,
        matchReasons: [m.recommendation],
        mismatchReasons: [],
        recommendation: m.recommendation,
        tips: '',
        job: job
      };
    }).filter(Boolean) as MatchResult[];

    if (onProgress) onProgress(results);
    return results;
  } catch (e) {
    console.error("Gemini Match Failed:", e);
    return [];
  }
};

/**
 * 岗位数据本地极速解析引擎
 */
export const parseSmartJobs = async (
  rawText: string, 
  onProgress?: (current: number, total: number, errorLines?: string[]) => void
): Promise<any[]> => {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split('\n');
  const allJobs: any[] = [];
  const errorLines: string[] = [];
  const total = lines.length;

  for (let i = 0; i < total; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('=') || line.startsWith('#') || line.includes('公司') && line.includes('链接')) {
      if (onProgress) onProgress(i + 1, total, errorLines);
      continue;
    }
    const parts = line.split(/[丨|]/).map(p => p.trim());
    if (parts.length >= 4) {
      const [company, position, location, link] = parts.length > 4 && parts[parts.length-1].startsWith('http') 
        ? [parts[0], parts.slice(1,-2).join('|'), parts[parts.length-2], parts[parts.length-1]]
        : parts;
      if (company && link && link.startsWith('http')) {
        allJobs.push({ company, title: position, location, link });
      } else {
        errorLines.push(`第 ${i+1} 行格式有误`);
      }
    }
    if (onProgress) onProgress(i + 1, total, errorLines);
  }
  return allJobs;
};
