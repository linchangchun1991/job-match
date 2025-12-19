
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 严格按照规范：API Key 必须排他性地从 process.env.API_KEY 获取
 * 使用 new GoogleGenAI({ apiKey: process.env.API_KEY }) 进行初始化
 */
const getAIClient = () => {
  const apiKey = (process.env.API_KEY || '').trim();
  return new GoogleGenAI({ apiKey });
};

export const parseResume = async (text: string): Promise<ParsedResume> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `你是一个高效的ATS简历解析器。请直接提取此简历的核心画像数据，严禁输出任何废话：\n\n${text.slice(0, 6000)}`,
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
            coreDomain: { type: Type.STRING },
            seniorityLevel: { type: Type.STRING },
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
          required: ["name", "coreDomain", "atsScore"]
        }
      }
    });
    
    // 规范：直接访问 .text 属性
    const textOutput = response.text;
    if (!textOutput) throw new Error("AI 解析结果为空");
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
    throw new Error(`解析失败: ${e.message}`);
  }
};

export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const validJobs = jobs.slice(0, 150);
  if (validJobs.length === 0) return [];

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        作为职业教练，请从下方岗位列表中选出最适合此候选人的10个岗位。
        候选人画像：${JSON.stringify(resume)}
        待选岗位（仅标题和公司）：${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}
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
                  i: { type: Type.NUMBER, description: "原始岗位索引" },
                  score: { type: Type.NUMBER },
                  reason: { type: Type.STRING, description: "推荐理由" }
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
      const originalJob = validJobs[m.i];
      if (!originalJob) return null;
      return {
        jobId: originalJob.id,
        score: m.score,
        matchReasons: [m.reason],
        recommendation: m.reason,
        job: { ...originalJob }
      };
    }).filter(Boolean) as MatchResult[];

    if (onProgress) onProgress(results);
    return results;
  } catch (e) {
    return [];
  }
};

export const parseSmartJobs = async (
  rawText: string, 
  onProgress?: (current: number, total: number, errorLines?: string[]) => void
): Promise<any[]> => {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/);
  const allJobs: any[] = [];
  const errorLines: string[] = [];
  const total = lines.length;

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+\/[^\s]*)/gi;

  for (let i = 0; i < total; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('=') || line.startsWith('#')) {
      if (onProgress) onProgress(i + 1, total, errorLines);
      continue;
    }

    let foundLink = '';
    const urlMatches = line.match(urlRegex);
    if (urlMatches && urlMatches.length > 0) {
      foundLink = urlMatches[0];
    }

    const textWithoutLink = foundLink ? line.replace(foundLink, '').trim() : line;
    const parts = textWithoutLink.split(/[|丨\t\s]{1,}/).map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length >= 1) {
      const company = parts[0] || '未知企业';
      const title = parts[1] || parts[0] + '招聘岗位';
      const location = parts[2] || '全国';
      
      allJobs.push({ 
        company, 
        title, 
        location, 
        link: foundLink 
      });
    } else {
      errorLines.push(`第 ${i+1} 行格式异常: ${line.slice(0, 20)}`);
    }
    
    if (onProgress) onProgress(i + 1, total, errorLines);
  }
  return allJobs;
};
