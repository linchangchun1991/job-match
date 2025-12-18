
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 极强力 JSON 提取器
 * 确保即使 AI 返回了 Markdown 包裹也能正确提取
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
  onProgress?: (current: number, total: number) => void
): Promise<any[]> => {
  // 将原始文本按行切分，不再做预过滤，直接交给 AI 识别
  const lines = rawText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 5); // 仅过滤掉极短的干扰行
  
  if (lines.length === 0) return [];

  // 极致稳定批次：每组只处理 5 行
  // 理由：您的数据一行可能拆出 20 个岗位，5 行就是 100 个岗位，JSON 长度极易爆表。
  const batchSize = 5; 
  const batches = [];
  for (let i = 0; i < lines.length; i += batchSize) {
    batches.push(lines.slice(i, i + batchSize));
  }

  let allJobs: any[] = [];
  const systemInstruction = `你是一个精准的招聘数据解析器。
输入数据是由管道符 (|) 分隔的文本，每行代表一家公司的招聘汇总。

解析规则：
1. 识别结构：[行业/类别] | [公司名] | [岗位列表] | [地点] | [直投链接] | [其他]
2. 核心任务：提取第2列(公司)和第3列(岗位)。
3. 关键动作：第3列通常包含多个岗位（如：产品类，技术类），你必须将其拆分为多个独立的岗位对象。
4. 分隔符识别：第3列的岗位可能被逗号(，,)、顿号(、)、空格、或甚至没有分隔符（需语义拆分）连接，请务必彻底拆开。
5. 必须返回包含 "jobs" 数组的 JSON 对象。

JSON 结构示例：
{
  "jobs": [
    {"company": "公司A", "title": "岗位1", "location": "地点", "link": "链接"},
    {"company": "公司A", "title": "岗位2", "location": "地点", "link": "链接"}
  ]
}

严禁丢失链接，严禁合并岗位，严禁输出非 JSON 文本。`;

  for (let i = 0; i < batches.length; i++) {
    if (onProgress) onProgress(i + 1, batches.length);
    try {
      const prompt = `请解析并拆分以下招聘信息（第3列为岗位池）：\n\n${batches[i].join('\n')}`;
      const res = await callAI({
        systemInstruction,
        prompt,
        temperature: 0.1
      });
      
      const cleaned = stripMarkdown(res.text);
      if (!cleaned) continue;

      const data = JSON.parse(cleaned);
      const jobsInBatch = data.jobs || (Array.isArray(data) ? data : []);
      
      if (Array.isArray(jobsInBatch)) {
        allJobs = [...allJobs, ...jobsInBatch];
      }
    } catch (e: any) {
      console.error(`[解析失败] 第 ${i+1} 批次:`, e.message);
      // 如果某一批次失败，继续处理下一批，而不是直接中断
    }
  }
  return allJobs;
};
