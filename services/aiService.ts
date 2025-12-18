
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 获取 API Key
 * 优先从 window.process.env 获取，兼容 index.html 的注入方式
 */
const getApiKey = () => {
  return (window as any).process?.env?.API_KEY || "";
};

/**
 * 强化版 JSON 提取器
 */
function stripMarkdown(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
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
 * DeepSeek API 调用核心 (使用 fetch 兼容 sk- 格式 Key)
 */
async function callDeepSeek(params: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key 未配置，请检查 index.html。");

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
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
    const err = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek API 错误: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return { text: data.choices[0].message.content || '' };
}

/**
 * 简历解析：使用 DeepSeek 引擎
 */
export const parseResume = async (text: string): Promise<ParsedResume> => {
  const systemInstruction = `你是一位顶级 HR 专家。请从简历文本中提取 JSON 画像。
  字段必须包含：name, phone, email, education, university, major, graduationYear, coreDomain, seniorityLevel, coreTags, atsScore, atsAnalysis, atsDimensions (education, skills, project, internship, quality)。`;

  try {
    const res = await callDeepSeek({
      systemInstruction,
      prompt: `简历内容：\n${text.slice(0, 8000)}`,
      temperature: 0.1
    });

    const data = JSON.parse(stripMarkdown(res.text));
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
    console.error("DeepSeek Parsing Error:", e);
    throw new Error(`简历解析失败: ${e.message}`);
  }
};

/**
 * 岗位匹配：使用 DeepSeek 引擎
 */
export const matchJobs = async (
  resume: ParsedResume, 
  jobs: Job[],
  onProgress?: (newMatches: MatchResult[]) => void
): Promise<MatchResult[]> => {
  const validJobs = jobs.slice(0, 100); 
  if (validJobs.length === 0) return [];

  const systemInstruction = `作为职业教练，请根据候选人画像和岗位列表进行匹配。返回 JSON 格式：{ "matches": [{ "i": 岗位索引, "score": 分数, "recommendation": "推荐理由" }] }`;

  try {
    const res = await callDeepSeek({
      systemInstruction,
      prompt: `候选人：${JSON.stringify(resume)}\n岗位列表：${JSON.stringify(validJobs.map((j, i) => ({ i, c: j.company, t: j.title })))}`,
      temperature: 0.2
    });

    const parsed = JSON.parse(stripMarkdown(res.text));
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
    console.error("DeepSeek Match Error:", e);
    return [];
  }
};

/**
 * 岗位数据解析：保持本地高性能正则引擎 ( gemini_fixed_parser.js 逻辑 )
 * 确保超大批量数据的极速导入和 100% 准确的分隔符识别
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
    const lineNumber = i + 1;

    // 跳过无关行
    if (!line || line.startsWith('=') || line.startsWith('#') || 
        line.includes('最新岗位大表') || (line.includes('公司') && line.includes('链接'))) {
      if (onProgress) onProgress(lineNumber, total, errorLines);
      continue;
    }

    const separator = /[丨|]/;
    let parts = line.split(separator).map(p => p.trim());

    // 自动兼容链接中含竖线的特殊情况
    if (parts.length > 4) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.startsWith('http')) {
        const company = parts[0];
        const position = parts.slice(1, parts.length - 2).join(' | ');
        const location = parts[parts.length - 2];
        const link = lastPart;
        parts = [company, position, location, link];
      } else {
        parts = parts.slice(0, 4);
      }
    }

    if (parts.length < 4) {
      errorLines.push(`第 ${lineNumber} 行: 字段缺失 (需4个，实为${parts.length})`);
    } else {
      const [company, position, location, link] = parts;
      if (company && link && link.startsWith('http')) {
        allJobs.push({ 
          company, 
          title: position || '通用岗位', 
          location: location || '全国', 
          link 
        });
      } else {
        errorLines.push(`第 ${lineNumber} 行: 公司名或链接格式有误`);
      }
    }

    if (onProgress) onProgress(lineNumber, total, errorLines);
  }

  return allJobs;
};
