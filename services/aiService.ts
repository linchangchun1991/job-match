
import { Job, ParsedResume, MatchResult } from '../types';

/**
 * 强化版 JSON 提取器
 * 用于简历解析（简历解析仍保留 AI 能力）
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
 * DeepSeek/Gemini API 调用核心（仅用于简历分析）
 */
async function callAI(params: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
}) {
  const key = (window as any).process?.env?.API_KEY || "";
  if (!key) throw new Error("API Key 未在 index.html 中正确配置。");

  // 这里为了保持与之前配置的一致性，依然指向 API 地址。
  // 注意：如果是 Gemini，通常会使用 @google/genai SDK，
  // 但此处遵循用户之前代码中使用 fetch 的结构。
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
    throw new Error(`AI API 错误: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return { text: data.choices[0].message.content || '' };
}

/**
 * 简历解析（保留 AI 能力）
 */
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

/**
 * 岗位匹配（保留 AI 能力）
 */
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

/**
 * 岗位数据解析：已完全替换为本地高性能解析逻辑 (基于 gemini_fixed_parser.js)
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

    // 1. 跳过标题行、分割线和空行
    if (!line || 
        line.startsWith('=') || 
        line.startsWith('#') ||
        line.includes('最新岗位大表') ||
        (line.includes('共') && line.includes('条')) ||
        line.includes('批次') ||
        line.includes('岗位数据') ||
        (line.includes('公司') && line.includes('岗位') && line.includes('链接'))) {
      if (onProgress) onProgress(lineNumber, total, errorLines);
      continue;
    }

    // 2. 支持中文和英文竖线分隔符
    const separator = /[丨|]/;
    let parts = line.split(separator).map(p => p.trim());

    // 3. 处理字段分割（兼容模式：合并链接前多余的竖线）
    if (parts.length > 4) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.startsWith('http://') || lastPart.startsWith('https://')) {
        const company = parts[0];
        const position = parts.slice(1, parts.length - 2).join(' | ');
        const location = parts[parts.length - 2];
        const link = lastPart;
        parts = [company, position, location, link];
      } else {
        parts = parts.slice(0, 4);
      }
    }

    // 4. 验证字段数量
    if (parts.length < 4) {
      errorLines.push(`第 ${lineNumber} 行: 字段不足 (需4个，实为${parts.length}) | 内容: ${line.substring(0, 30)}...`);
      if (onProgress) onProgress(lineNumber, total, errorLines);
      continue;
    }

    const [company, position, location, link] = parts;

    // 5. 必填字段校验
    if (!company) {
      errorLines.push(`第 ${lineNumber} 行: 公司名称不能为空`);
    } else if (!link) {
      errorLines.push(`第 ${lineNumber} 行: 投递链接不能为空`);
    } 
    // 6. 链接格式验证
    else if (!link.startsWith('http://') && !link.startsWith('https://')) {
      errorLines.push(`第 ${lineNumber} 行: 链接格式错误 (需 http/https 开头)`);
    } else {
      // 7. 单行解析成功，加入结果集 (将 position 映射为 title)
      allJobs.push({
        company: company,
        title: position || '通用岗位',
        location: location || '全国',
        link: link
      });
    }

    // 更新进度
    if (onProgress) onProgress(lineNumber, total, errorLines);
  }

  return allJobs;
};
