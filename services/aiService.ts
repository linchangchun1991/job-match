import { Job, ParsedResume, MatchResult } from '../types';

const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-plus';

interface QwenMessage {
  role: 'system' | 'user';
  content: string;
}

async function callQwen(apiKey: string, messages: QwenMessage[]) {
  if (!apiKey) throw new Error("请在设置中配置API Key");

  let retries = 2;
  while (retries >= 0) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: messages,
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (e) {
      if (retries === 0) throw e;
      retries--;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

export const parseResume = async (apiKey: string, text: string): Promise<ParsedResume> => {
  const systemPrompt = `你是由HighMark开发的资深校招ATS系统。请对简历进行深度结构化解析。
  
  请返回严格的JSON格式：
  {
    "name": "姓名",
    "education": "最高学历",
    "university": "毕业院校",
    "major": "专业",
    "graduationYear": "毕业年份(如2026)",
    "graduationType": "届别(如2026届)",
    "expectedCities": ["城市1"],
    "skills": ["技能1"],
    "experience": "经历摘要",
    "jobPreference": "求职意向",
    "atsScore": 总分(0-100),
    "atsDimensions": {
      "education": 0-100, 
      "experience": 0-100, 
      "relevance": 0-100, 
      "stability": 0-100, 
      "leadership": 0-100, 
      "skills": 0-100, 
      "language": 0-100, 
      "certificate": 0-100, 
      "format": 0-100 
    },
    "atsAnalysis": "请严格按照以下格式返回字符串(包含换行符)：\\n✅ 核心优势：简练评价优点...\\n⚠️ 潜在短板：客观指出不足...\\n💡 提升建议：一句话改进建议..."
  }`;

  const truncatedText = text.length > 8000 ? text.slice(0, 8000) + "...(截断)" : text;

  const result = await callQwen(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `简历内容：\n${truncatedText}` }
  ]);

  try {
    return JSON.parse(result as string);
  } catch (e) {
    console.error("Resume parsing failed", e);
    throw new Error("简历解析失败，请检查文件内容是否可读。");
  }
};

export const matchJobs = async (apiKey: string, resume: ParsedResume, jobs: Job[]): Promise<MatchResult[]> => {
  // Increased batch size and concurrency for speed
  const BATCH_SIZE = 30; 
  
  const chunks: Job[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    chunks.push(jobs.slice(i, i + BATCH_SIZE));
  }

  const systemPrompt = `你是HighMark人岗匹配引擎。请根据简历与岗位列表进行评分。

  【核心匹配逻辑】:
  1. **校招/实习身份隔离**: 已毕业(2024及以前)严禁匹配实习岗位(0分)；在校生(2026/2027)优先匹配实习/校招。
  2. **届别严格匹配**: 岗位要求的届别必须与候选人一致。
  3. **专业与技能**: 专业对口度权重高。

  请返回JSON对象，包含 key "matches" (数组):
  [{
    "id": "岗位ID",
    "s": 0-100 (分数),
    "r": ["理由1", "理由2"],
    "k": ["风险点"],
    "t": "建议"
  }]`;

  // Increased concurrency limit to 8 for faster processing
  const CONCURRENCY_LIMIT = 8;
  let allResults: MatchResult[] = [];
  
  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const activeChunks = chunks.slice(i, i + CONCURRENCY_LIMIT);
    
    const chunkPromises = activeChunks.map(async (batch) => {
      const simplifiedJobs = batch.map(j => ({
        id: j.id,
        c: j.company,
        l: j.location,
        type: j.type,
        req: j.requirement,
        t: j.title
      }));

      const userPrompt = `
      候选人: ${resume.graduationType} ${resume.education} ${resume.major}
      岗位表: ${JSON.stringify(simplifiedJobs)}
      `;

      try {
        const resultStr = await callQwen(apiKey, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]);
        
        const parsed = JSON.parse(resultStr as string);
        return parsed.matches.map((m: any) => ({
          jobId: m.id,
          score: m.s,
          matchReasons: m.r || [],
          mismatchReasons: m.k || [],
          recommendation: m.s >= 85 ? '极力推荐' : m.s >= 70 ? '推荐' : '一般',
          tips: m.t,
          job: batch.find(j => j.id === m.id)
        })).filter((m: any) => m.job);
      } catch (e) {
        console.error("Batch match failed", e);
        return [];
      }
    });

    const results = await Promise.all(chunkPromises);
    results.forEach(res => {
      allResults = [...allResults, ...res];
    });
  }

  return allResults.sort((a, b) => b.score - a.score);
};