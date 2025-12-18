import { Job, MatchResult, MatchSession } from '../types';

const KEYS = {
  JOBS: 'careermatch_jobs',
  HISTORY: 'careermatch_history',
  SESSIONS: 'careermatch_sessions',
  SUPABASE_URL: 'careermatch_supabase_url',
  SUPABASE_KEY: 'careermatch_supabase_key',
  QWEN_KEY: 'careermatch_qwen_key'
};

export const storage = {
  getJobs: (): Job[] => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.JOBS) || '[]');
    } catch {
      return [];
    }
  },
  setJobs: (jobs: Job[]) => localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs)),
  
  getSessions: (): MatchSession[] => {
    try {
      const data = localStorage.getItem(KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveSession: (session: MatchSession) => {
    const sessions = storage.getSessions();
    const newSessions = [session, ...sessions].slice(0, 20);
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(newSessions));
    return newSessions;
  },
  clearSessions: () => {
    localStorage.removeItem(KEYS.SESSIONS);
    return [];
  },

  getSupabaseConfig: () => {
    // 强制去除首尾空格
    const url = (localStorage.getItem(KEYS.SUPABASE_URL) || "").trim();
    const key = (localStorage.getItem(KEYS.SUPABASE_KEY) || "").trim();
    return { url, key };
  },
  
  setSupabaseConfig: (url: string, key: string) => {
    localStorage.setItem(KEYS.SUPABASE_URL, url.trim());
    localStorage.setItem(KEYS.SUPABASE_KEY, key.trim());
  },

  getQwenKey: () => localStorage.getItem(KEYS.QWEN_KEY) || '',
  setQwenKey: (key: string) => localStorage.setItem(KEYS.QWEN_KEY, key.trim())
};