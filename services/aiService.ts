
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

// Create AI client using the mandated process.env.API_KEY
const getAIClient = () => {
  // 严格遵守：仅从 process.env.API_KEY 获取，不设硬编码回退
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 未配置，请联系系统管理员。");
  return new GoogleGenAI({ apiKey });
};

export const parseResume = async (text: string): Promise<ParsedResume> => {
  try {
    const ai = getAIClient();
    // Using gemini-3-pro-preview for complex reasoning in resume parsing
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `你是一个专业的求职咨询专家。请分析以下简历文本，提取候选人画像。
要求：
1. 提取核心领域（如：互联网营销、Java开发）。
2. 评估资历等级（如：应届生、初级、资深）。
3. 给出 ATS 适配分 (0-100)。
4. 提取 5 个核心关键词。

简历文本：\n${text.slice(0, 8000)}`,
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
    
    // Access text property directly (not a method) as per guidelines
    const jsonStr = response.text || '{}';
    const data = JSON.parse(jsonStr);
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
    throw new Error(`简历解析失败: ${e.message}`);
  }
};

export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  if (jobs.length === 0) return [];
  const sampleJobs = jobs.slice(0, 100); // 选取最近100个岗位进行匹配

  try {
    const ai = getAIClient();
    // Using gemini-3-pro-preview for high-quality matching recommendations
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `你是一个金牌职业教练。请根据候选人画像，从提供的岗位列表中选出最匹配的 10 个。
候选人：${JSON.stringify(resume)}
岗位列表：${JSON.stringify(sampleJobs.map((j, i) => ({ id: j.id, c: j.company, t: j.title, idx: i })))}`,
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
                  idx: { type: Type.NUMBER },
                  score: { type: Type.NUMBER },
                  reason: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    // Access text property directly (not a method) as per guidelines
    const jsonStr = response.text || '{"matches":[]}';
    const parsed = JSON.parse(jsonStr);
    const results = (parsed.matches || []).map((m: any) => {
      const job = sampleJobs[m.idx];
      if (!job) return null;
      return {
        jobId: job.id,
        score: m.score,
        matchReasons: [m.reason],
        recommendation: m.reason,
        job: { ...job }
      };
    }).filter(Boolean) as MatchResult[];

    if (onProgress) onProgress(results);
    return results;
  } catch (e) {
    console.error("Match error:", e);
    return [];
  }
};

export const parseSmartJobs = async (rawText: string): Promise<any[]> => {
  if (!rawText) return [];
  const lines = rawText.split(/\n/).filter(l => l.trim());
  const jobs: any[] = [];

  for (const line of lines) {
    const parts = line.split(/[|丨\t\s]{1,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const linkMatch = line.match(/https?:\/\/[^\s]+/i);
      jobs.push({
        company: parts[0],
        title: parts[1],
        location: parts[2] || '全国',
        link: linkMatch ? linkMatch[0] : ''
      });
    }
  }
  return jobs;
};
