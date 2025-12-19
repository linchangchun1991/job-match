
import { Job, MatchResult, MatchSession } from '../types';

const KEYS = {
  JOBS: 'careermatch_jobs',
  HISTORY: 'careermatch_history',
  SESSIONS: 'careermatch_sessions',
  SUPABASE_URL: 'careermatch_supabase_url',
  SUPABASE_KEY: 'careermatch_supabase_key',
  API_KEY: 'careermatch_gemini_key'
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
    const url = (localStorage.getItem(KEYS.SUPABASE_URL) || "").trim();
    const key = (localStorage.getItem(KEYS.SUPABASE_KEY) || "").trim();
    return { url, key };
  },
  
  setSupabaseConfig: (url: string, key: string) => {
    localStorage.setItem(KEYS.SUPABASE_URL, url.trim());
    localStorage.setItem(KEYS.SUPABASE_KEY, key.trim());
  },

  getApiKey: () => localStorage.getItem(KEYS.API_KEY) || '',
  setApiKey: (key: string) => localStorage.setItem(KEYS.API_KEY, key.trim())
};
