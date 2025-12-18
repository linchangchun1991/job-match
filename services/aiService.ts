
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 强化版 JSON 提取器
 * 支持 Markdown 包裹和纯净 JSON 字符串
 */
function stripMarkdown(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  
  // 尝试直接解析
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed;

  let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * DeepSeek API 调用核心
 */
async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
}) {
  const key = (window as any).process?.env?.API_KEY || "";
  if (!key) throw new Error("API Key 未在 index.html 中正确配置。");

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
      // 开启 JSON 模式，确保返回格式正确
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
  // 核心变更：精准行提取
  const lines = rawText.split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('|') && line.length > 10 && !line.includes('==='));
  
  if (lines.length === 0) return [];

  // 极致稳定性优化：1 行调用一次
  // 因为您的一行数据（如山东能源或联芸科技）极其复杂，包含数十个岗位。
  // 批量解析会导致 AI 返回的 JSON 长度超过单次输出限制，造成截断报错。
  let allJobs: any[] = [];
  const systemInstruction = `你是一个高精度的招聘数据提取机器人。
你将收到一行包含管道符 (|) 分隔的招聘文本。

解析规则：
1. 结构识别：[行业] | [公司名] | [岗位池] | [地点] | [链接]
2. 强制任务：如果第3列(岗位池)包含多个岗位（用逗号、顿号、空格、或仅仅是词语拼接），你必须将它们完全拆分为多个独立的 JSON 对象。
3. 必须输出包含 "jobs" 键的 JSON 对象。

示例输出：
{"jobs": [{"company": "xxx", "title": "岗位1", "location": "xxx", "link": "xxx"}]}

严禁合并岗位！必须拆开！`;

  for (let i = 0; i < lines.length; i++) {
    if (onProgress) onProgress(i + 1, lines.length);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `解析此行并拆分所有岗位：\n${lines[i]}`,
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text);
      if (!cleaned) continue;

      const data = JSON.parse(cleaned);
      const jobsInLine = data.jobs || [];
      
      if (Array.isArray(jobsInLine)) {
        allJobs = [...allJobs, ...jobsInLine];
      }
    } catch (e: any) {
      console.error(`[行解析失败] 内容: ${lines[i].slice(0, 30)}... | 错误:`, e.message);
    }
  }
  return allJobs;
};
