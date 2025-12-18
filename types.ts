
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
  education: number;      // 教育背景 (20%)
  skills: number;         // 专业技能 (25%)
  project: number;        // 项目经验 (25%)
  internship: number;     // 实习经历 (20%)
  quality: number;        // 综合素质 (10%)
}

export interface ParsedResume {
  name: any;
  phone: any;
  email: any;
  education: any; 
  university: any;
  major: any;
  graduationYear: any;
  graduationDate: any;
  graduationType?: any;          // 新增: 毕业类型（应届/往届）
  isFreshGrad: boolean;
  workYears: number;
  expectedCities: string[];
  skills: string[];
  experience: any;
  jobPreference: any;
  tags: {
    degree: string[];
    exp: string[];
    skill: string[];
    intent: string[];
  };
  atsScore: number; 
  atsDimensions: AtsDimensions; 
  atsAnalysis: string; 
}

export interface MatchResult {
  jobId: string;
  score: number;
  matchReasons: string[];
  mismatchReasons: string[];
  recommendation: string; 
  tips: string;
  job: Job;
  tags?: string[];
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
