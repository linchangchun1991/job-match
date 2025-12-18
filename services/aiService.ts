
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
  onProgress?: (current: number, total: number, errorLines?: string[]) => void
): Promise<any[]> => {
  // 支持中英文竖线: | (U+007C) 和 丨 (U+4E28)
  const delimiterRegex = /[|丨]/;
  const lines = rawText.split('\n')
    .map(line => line.trim())
    .filter(line => delimiterRegex.test(line) && line.length > 5 && !line.includes('==='));
  
  if (lines.length === 0) return [];

  let allJobs: any[] = [];
  let errorLines: string[] = [];

  const systemInstruction = `你是一个精准的招聘数据解析器。
输入是以竖线（| 或 丨）分隔的行数据。

解析规则：
1. 识别字段数量：
   - 5个字段：[行业] | [公司] | [岗位池] | [地点] | [链接]
   - 4个字段：[公司] | [岗位池] | [地点] | [链接]
2. 强制要求：
   - 如果第3列（5字段）或第2列（4字段）包含多个岗位，必须拆分为多个对象。
   - 验证：[公司] 和 [链接] 必须存在且非空。
3. 错误处理：如果字段数量不是 4 或 5，或者缺少关键字段，请在返回的 JSON 中包含 "error" 字段说明原因。

输出格式示例：
{
  "jobs": [{"company": "A", "title": "B", "location": "C", "link": "D"}],
  "error": null
}`;

  for (let i = 0; i < lines.length; i++) {
    if (onProgress) onProgress(i + 1, lines.length, errorLines);
    try {
      const res = await callAI({
        systemInstruction,
        prompt: `解析此行内容：\n${lines[i]}`,
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text);
      if (!cleaned) continue;

      const data = JSON.parse(cleaned);
      
      if (data.error) {
        errorLines.push(`第 ${i+1} 行: ${data.error} (内容: ${lines[i].slice(0,20)}...)`);
        continue;
      }

      const jobsInLine = data.jobs || [];
      if (Array.isArray(jobsInLine)) {
        // 二次验证必填项
        const validJobs = jobsInLine.filter(j => j.company && j.link);
        if (validJobs.length < jobsInLine.length) {
            errorLines.push(`第 ${i+1} 行: 存在缺失[公司]或[链接]的子岗位`);
        }
        allJobs = [...allJobs, ...validJobs];
      }
    } catch (e: any) {
      errorLines.push(`第 ${i+1} 行: 解析异常 - ${e.message}`);
    }
  }
  return allJobs;
};
