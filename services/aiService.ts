
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 极强力 JSON 提取器
 * 无论 AI 返回多少废话，都能定位并完整切出 JSON 块
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
 * 标准 DeepSeek API 调用
 */
async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
}) {
  const key = (window as any).process?.env?.API_KEY || "";
  if (!key) throw new Error("API Key 未设置。");

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: params.systemInstruction },
        { role: "user", content: params.prompt }
      ],
      temperature: params.temperature ?? 0.1,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`DeepSeek API 错误: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return { text: data.choices[0].message.content || '' };
}

export const parseResume = async (text: string): Promise<ParsedResume> => {
  const systemInstruction = `你是一位顶级 HR 专家。请从简历文本中提取 JSON 画像。字段包含：coreDomain, seniorityLevel, coreTags, atsDimensions, atsAnalysis, atsScore, name, phone, email, education, university, major, graduationYear, skills, experience, jobPreference。`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历内容：\n${text.slice(0, 8000)}`,
      temperature: 0.1
    });

    const data = JSON.parse(stripMarkdown(res.text));
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

  const systemInstruction = `你是职业教练，匹配简历与职位。返回 JSON：{ "matches": [{ "i": 索引, "s": 分数, "reasons": [原因], "coach_advice": "话术" }] }`;

  try {
    const res = await callAI({
      systemInstruction,
      prompt: `简历: ${JSON.stringify(resume)}\n岗位: ${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
      temperature: 0.3
    });

    const parsed = JSON.parse(stripMarkdown(res.text));
    const results = (parsed.matches || []).map((m: any) => {
      const job = validJobs[m.i];
      if (!job) return null;
      return {
        jobId: job.id,
        score: m.s,
        matchReasons: m.reasons || [],
        mismatchReasons: [],
        recommendation: m.coach_advice || '推荐投递',
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
  // 必须大幅减小分块：因为一个格子可能拆分出20个对象，JSON 长度会膨胀10倍
  // 2000 字符是保证 DeepSeek 不断开的最稳分块大小
  const chunkSize = 2000; 
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) {
    chunks.push(rawText.slice(i, i + chunkSize));
  }

  let allJobs: any[] = [];
  const systemInstruction = `你是一个精准的数据转换机器人。
输入格式：[行业] | [公司名] | [岗位列表] | [地点] | [链接] | [备注]
核心规则：
1. 必须识别第2列为 "company"，第3列为 "title"。
2. 如果第3列包含多个岗位（用逗号、空格、顿号分隔），你必须将其拆分为多个独立的 JSON 对象。
3. 必须输出包含 "jobs" 数组的 JSON 对象。

示例输入：
游戏 | 4399 | 产品类，技术类 | 广州 | https://link

示例输出：
{"jobs": [
  {"company": "4399", "title": "产品类", "location": "广州", "link": "https://link"},
  {"company": "4399", "title": "技术类", "location": "广州", "link": "https://link"}
]}

严禁合并多个岗位到同一个 title 字段！`;

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `请提取并拆分以下文本中的所有独立岗位：\n${chunks[i]}`,
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text);
      const data = JSON.parse(cleaned);
      
      const jobsInChunk = data.jobs || (Array.isArray(data) ? data : []);
      if (Array.isArray(jobsInChunk)) {
        allJobs = [...allJobs, ...jobsInChunk];
      }
    } catch (e: any) {
      console.warn(`[解析警告] 分段 ${i+1} 可能由于输出过长解析失败:`, e.message);
    }
  }
  return allJobs;
};
