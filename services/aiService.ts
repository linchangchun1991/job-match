import { GoogleGenAI } from "@google/genai";
import { Job, ParsedResume, MatchResult } from '../types';

function stripMarkdown(str: string): string {
  if (!str) return "";
  return str.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * 智能清洗岗位数据 - 使用 Gemini 3.0 Flash
 */
export const parseSmartJobs = async (
  rawText: string, 
  onProgress?: (current: number, total: number) => void
): Promise<any[]> => {
  // 遵循原则：使用 process.env.API_KEY 初始化
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `你是一个专业的数据解析助手。任务是解析从“腾讯云智服知识库”导出的杂乱文本。
**处理规则**：
1. **剔除噪音**：忽略所有时间戳、忽略发言人姓名。
2. **提取四要素**：
   - **company**: 公司名称（去除“急招”、“置顶”等修饰语）。
   - **title**: 岗位名。
   - **location**: 地点（若未提及则填“全国”）。
   - **link**: 投递链接。必须是完整链接。
3. **输出格式**：返回纯 JSON 数组。`;

  const chunkSize = 4000;
  const textChunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) {
    textChunks.push(rawText.slice(i, i + chunkSize));
  }

  let allJobs: any[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    if (onProgress) onProgress(i + 1, textChunks.length);
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `请提取以下知识库片段中的岗位信息：\n${textChunks[i]}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const resultStr = response.text;
      if (!resultStr) continue;
      
      const chunkJobs = JSON.parse(stripMarkdown(resultStr));
      if (Array.isArray(chunkJobs)) {
        allJobs = [...allJobs, ...chunkJobs];
      }
    } catch (e) {
      console.warn(`Chunk ${i} failed:`, e);
    }
  }

  const uniqueMap = new Map();
  allJobs.forEach(j => {
      const key = `${j.company}-${j.title}`;
      uniqueMap.set(key, j);
  });

  return Array.from(uniqueMap.values());
};

/**
 * 简历解析 - 使用 Gemini 3.0 Pro 深度分析
 */
export const parseResume = async (text: string): Promise<ParsedResume> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const currentDate = new Date().toISOString().split('T')[0];
  const systemInstruction = `你是一个严谨的简历解析引擎。当前日期是 ${currentDate}。
请按要求解析简历并返回 JSON。所有字段必须为字符串或数值，禁止嵌套对象。
输出 JSON 结构：
{
  "name": "姓名",
  "phone": "电话",
  "email": "邮箱",
  "education": "最高学历描述",
  "university": "毕业院校",
  "major": "专业",
  "graduationYear": "毕业年份",
  "graduationDate": "毕业年月 YYYY.MM",
  "graduationType": "应届生/往届生",
  "isFreshGrad": true/false,
  "workYears": 0,
  "expectedCities": ["城市"],
  "skills": ["技能"],
  "experience": "经历总结",
  "jobPreference": "意向岗位",
  "tags": { "degree": [], "exp": [], "skill": [], "intent": [] },
  "atsScore": 85,
  "atsDimensions": { "education": 80, "skills": 85, "project": 90, "internship": 80, "quality": 90 },
  "atsAnalysis": "AI诊断建议"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `简历内容：\n${text.slice(0, 10000)}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    const cleaned = stripMarkdown(response.text || '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Parse Resume Error:", e);
    throw new Error("简历解析失败，AI 系统暂不可用，请稍后再试");
  }
};

/**
 * 岗位匹配 - 极速并发匹配
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const validJobs = jobs.filter(j => j.company && j.title).slice(0, 100); 
  if (validJobs.length === 0) return [];

  const systemInstruction = `你是一位首席人才架构师。请根据简历匹配岗位，给出分数(0-100)和理由。
返回 JSON 格式: { "matches": [{ "i": 岗位索引, "s": 分数, "reasons": ["理由"], "risks": ["风险"], "advice": "建议" }] }`;

  const userPrompt = `候选人: ${resume.name} | 意向: ${resume.jobPreference} \n 岗位池: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const cleaned = stripMarkdown(response.text || '');
    const parsed = JSON.parse(cleaned);
    const list = parsed.matches || parsed;

    const results = list.map((m: any) => {
      const job = validJobs[m.i];
      if (!job) return null;
      return {
        jobId: job.id,
        score: m.s,
        matchReasons: m.reasons || [],
        mismatchReasons: m.risks || [],
        recommendation: m.s >= 80 ? '高度推荐' : '可考虑',
        tips: m.advice || '',
        job: job
      };
    }).filter(Boolean);

    if (onProgress) onProgress(results);
    return results;
  } catch (e) {
    console.error("Match Jobs Error:", e);
    return [];
  }
};