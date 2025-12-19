
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 获取 AI 客户端实例
 * 优先级：自定义 Key > 环境变量
 */
const getAIClient = (customKey?: string) => {
  const apiKey = (customKey || process.env.API_KEY || 'AIzaSyBQquueBtsfVxqMQy4GV6kKaqLjVU9Wo20').trim();
  return new GoogleGenAI({ apiKey });
};

/**
 * 简历智能解析 - 极速版
 */
export const parseResume = async (text: string, apiKey?: string): Promise<ParsedResume> => {
  try {
    const ai = getAIClient(apiKey);
    // 简化 Prompt 减少推理耗时，直接要求结果
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
    console.error("Parse Error:", e);
    throw new Error(`解析失败: ${e.message}`);
  }
};

/**
 * 岗位匹配 - 关联原始数据
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  apiKey?: string,
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  // 限制匹配池，确保速度
  const validJobs = jobs.slice(0, 150);
  if (validJobs.length === 0) return [];

  try {
    const ai = getAIClient(apiKey);
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
        job: originalJob // 关键：确保保留完整的 Job 对象（含 link）
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
 * 岗位数据解析 - 增强型正则，解决链接丢失问题
 */
export const parseSmartJobs = async (
  rawText: string, 
  onProgress?: (current: number, total: number, errorLines?: string[]) => void
): Promise<any[]> => {
  if (!rawText || typeof rawText !== 'string') return [];
  
  // 按照换行拆分
  const lines = rawText.split(/\r?\n/);
  const allJobs: any[] = [];
  const errorLines: string[] = [];
  const total = lines.length;

  for (let i = 0; i < total; i++) {
    const line = lines[i].trim();
    // 过滤掉标题行和空行
    if (!line || line.startsWith('=') || line.startsWith('#') || line.includes('链接')) {
      if (onProgress) onProgress(i + 1, total, errorLines);
      continue;
    }

    // 支持多种分隔符：竖线、中文竖线、Tab、连续两个以上的空格
    const parts = line.split(/[|丨\t]|\s{2,}/).map(p => p.trim()).filter(Boolean);
    
    if (parts.length >= 2) {
      // 寻找其中的 URL 链接
      let link = '';
      let linkIdx = -1;
      
      parts.forEach((p, idx) => {
        if (p.toLowerCase().startsWith('http') || p.toLowerCase().startsWith('www.')) {
          link = p;
          linkIdx = idx;
        }
      });

      // 如果找到了链接，或者字段数足够
      if (parts.length >= 3 || link) {
        // 尝试构建 Job
        // 典型格式：公司 | 岗位 | 地点 | 链接
        const company = parts[0];
        const title = parts[1] || '待定岗位';
        const location = parts[2] && parts[2] !== link ? parts[2] : '全国';
        
        allJobs.push({ 
          company, 
          title, 
          location, 
          link: link || '' 
        });
      } else {
        errorLines.push(`第 ${i+1} 行格式不全: ${line.slice(0, 20)}...`);
      }
    }
    
    if (onProgress) onProgress(i + 1, total, errorLines);
  }
  return allJobs;
};
