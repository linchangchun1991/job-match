
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL; 
  
  if (!apiKey) throw new Error("GEMINI_API_KEY 未配置，请联系系统管理员。");
  
  // 关键：如果不传 baseUrl，SDK 默认连 googleapis.com，国内会挂。
  // 用户必须在 Zeabur 设置 GEMINI_BASE_URL (例如: https://generativelanguage.googleapis.com 对应的代理地址)
  // 或者使用第三方中转服务
  const options: any = { apiKey };
  if (baseUrl && baseUrl.startsWith('http')) {
     options.baseUrl = baseUrl;
  }

  return new GoogleGenAI(options);
};

const cleanJsonResponse = (str: string): string => {
  try {
    const cleaned = str.replace(/```json\n?|```/g, '').trim();
    return cleaned.replace(/,\s*([\]}])/g, '$1');
  } catch {
    return str;
  }
};

export const parseResume = async (text: string): Promise<ParsedResume> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `你是一个专业的求职咨询专家。请分析以下简历文本，提取候选人画像。
要求：
1. 提取核心领域。
2. 评估资历等级。
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
    
    const jsonStr = cleanJsonResponse(response.text || '{}');
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
    if (e.message && e.message.includes('fetch')) {
       throw new Error(`网络连接失败：请检查 GEMINI_BASE_URL 是否正确配置，或确认当前网络能否访问 Google API。`);
    }
    throw new Error(`简历解析失败: ${e.message}`);
  }
};

export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  if (jobs.length === 0) return [];
  const sampleJobs = jobs.slice(0, 100);

  try {
    const ai = getAIClient();
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

    const jsonStr = cleanJsonResponse(response.text || '{"matches":[]}');
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

/**
 * 智能解析岗位文本 V2 (Zeabur 专用优化版)
 * 格式支持：公司 | 岗位1，岗位2，岗位3 | 地点 | 链接
 * 逻辑：自动拆分中间的岗位名称，生成多条记录
 */
export const parseSmartJobs = async (rawText: string): Promise<any[]> => {
  if (!rawText) return [];
  const lines = rawText.split(/\n/).filter(l => l.trim());
  const jobs: any[] = [];

  for (const line of lines) {
    // 1. 按竖线拆分 (支持中文丨和英文|)
    const parts = line.split(/[|丨]/).map(p => p.trim());
    
    // 至少要有: 公司 | 岗位
    if (parts.length < 2) continue;

    const company = parts[0];
    const rawTitles = parts[1]; // 例如 "产品类，技术类，职能类"
    const location = parts[2] || '全国';
    
    // 2. 智能提取链接
    // 如果第4部分存在且包含http，就用它；或者在整行里找 http
    let link = parts[3] || '';
    if (!link.includes('http')) {
        const urlMatch = line.match(/https?:\/\/[^\s,，|丨]+/i);
        if (urlMatch) link = urlMatch[0];
    } else {
        // 如果 parts[3] 只是链接的一部分（有时候会被截断），尝试修复或提取
        const urlMatch = link.match(/https?:\/\/[^\s,，|丨]+/i);
        if (urlMatch) link = urlMatch[0];
    }

    // 3. 处理“一行多岗”逻辑
    // 按中文逗号、英文逗号、顿号、空格拆分岗位
    // 例子: "产品类，技术类，职能类" -> ["产品类", "技术类", "职能类"]
    const titles = rawTitles.split(/[,，、]/).map(t => t.trim()).filter(Boolean);

    // 4. 裂变为多个 Job 对象
    if (titles.length > 0) {
        for (const title of titles) {
            jobs.push({
                company,
                title, 
                location,
                link
            });
        }
    } else {
        // 如果没有逗号，就当做一个岗位
        jobs.push({
            company,
            title: rawTitles,
            location,
            link
        });
    }
  }
  return jobs;
};
