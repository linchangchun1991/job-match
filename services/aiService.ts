
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 获取 AI 客户端实例
 */
const getAIClient = (customKey?: string) => {
  const apiKey = customKey || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key 未配置。请在系统设置中填入有效的 API Key。");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 简历智能解析
 */
export const parseResume = async (text: string, apiKey?: string): Promise<ParsedResume> => {
  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `你是一位顶级 HR 专家。请解析以下简历内容并生成标准画像：\n${text.slice(0, 8000)}`,
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
            coreDomain: { type: Type.STRING, description: "如：互联网金融、半导体研发等" },
            seniorityLevel: { type: Type.STRING, description: "如：初级、资深、专家" },
            coreTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            atsScore: { type: Type.NUMBER },
            atsAnalysis: { type: Type.STRING },
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

    const textOutput = response.text;
    if (!textOutput) throw new Error("AI 返回内容为空");
    
    const data = JSON.parse(textOutput);
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
    console.error("AI Parsing Error:", e);
    throw new Error(`简历解析失败: ${e.message || '未知错误'}`);
  }
};

/**
 * 岗位匹配
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  apiKey?: string,
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const validJobs = jobs.slice(0, 100);
  if (validJobs.length === 0) return [];

  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        你是一位资深职业教练。请根据候选人画像和岗位列表进行匹配。
        候选人：${JSON.stringify(resume)}
        岗位列表：${JSON.stringify(validJobs.map((j, i) => ({ i, company: j.company, title: j.title })))}
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
                  i: { type: Type.NUMBER, description: "岗位索引" },
                  score: { type: Type.NUMBER },
                  recommendation: { type: Type.STRING, description: "推荐语" }
                }
              }
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) return [];
    
    const parsed = JSON.parse(textOutput);
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
    console.error("Match Error:", e);
    return [];
  }
};

/**
 * 岗位数据解析
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
    if (!line || line.startsWith('=') || line.startsWith('#') || (line.includes('公司') && line.includes('链接'))) {
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
