
export type UserRole = 'coach' | 'bd' | null;

export interface Job {
  id: string;
  company: string;
  location: string;
  type: string;
  requirement: string;
  title: string;
  updateTime: string;
  link?: string; 
}

export interface AtsDimensions {
  education: number;      
  skills: number;         
  project: number;        
  internship: number;     
  quality: number;        
}

export interface ParsedResume {
  name: string;
  phone: string;
  email: string;
  education: string; 
  university: string;
  major: string;
  graduationYear: string;
  graduationDate: string;
  graduationType?: string;
  isFreshGrad: boolean;
  workYears: number;
  expectedCities: string[];
  skills: string[];
  experience: string;
  jobPreference: string;
  // 新增画像字段
  coreDomain: string;      // 核心领域
  seniorityLevel: string;  // 资历评估
  coreTags: string[];      // 核心标签
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