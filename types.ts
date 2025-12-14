export type UserRole = 'coach' | 'bd' | null;

export interface Job {
  id: string;
  company: string;
  location: string;
  type: string;
  requirement: string;
  title: string;
  updateTime: string;
  link?: string; // 投递链接
}

export interface AtsDimensions {
  education: number;      // 教育背景 (院校档次/学历)
  experience: number;     // 实习经历 (大厂/核心岗)
  relevance: number;      // 实习相关性 (人岗匹配)
  stability: number;      // 稳定性 (每段经历时长)
  leadership: number;     // 领导力/社团/奖项
  skills: number;         // 硬技能 (编程/数据/设计等)
  language: number;       // 语言能力 (四六级/雅思)
  certificate: number;    // 证书/资格认证
  format: number;         // 简历规范性
}

export interface ParsedResume {
  name: string | null;
  education: string | null; // Highest Degree
  university: string | null;
  major: string | null;
  graduationYear: string | null;
  graduationType: string | null; // e.g., '2026届'
  expectedCities: string[];
  skills: string[];
  experience: string | null;
  jobPreference: string | null;
  atsScore: number; // Total weighted score
  atsDimensions: AtsDimensions; // Detailed dimension scores
  atsAnalysis: string; // Brief ATS feedback
}

export interface MatchResult {
  jobId: string;
  score: number;
  matchReasons: string[];
  mismatchReasons: string[];
  recommendation: string; // 推荐程度
  tips: string;
  job: Job;
}

export interface MatchSession {
  id: string;
  timestamp: number;
  candidateName: string;
  resumeText: string;
  parsedResume: ParsedResume;
  results: MatchResult[];
}

export interface AppState {
  userRole: UserRole;
  apiKey: string;
  jobs: Job[];
  currentResume: string;
  parsedResume: ParsedResume | null;
  matchResults: MatchResult[];
  matchHistory: MatchSession[];
  isAnalyzing: boolean;
  isMatching: boolean;
  settingsOpen: boolean;
  historyOpen: boolean;
}