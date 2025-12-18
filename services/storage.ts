import { Job, MatchResult, MatchSession } from '../types';

const KEYS = {
  JOBS: 'careermatch_jobs',
  HISTORY: 'careermatch_history',
  SESSIONS: 'careermatch_sessions',
  SUPABASE_URL: 'careermatch_supabase_url',
  SUPABASE_KEY: 'careermatch_supabase_key'
};

// Hardcoded Supabase keys fallback
const PRESET_SUPABASE_URL = 'https://axxatrqqfhscokyutnla.supabase.co';
const PRESET_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4eGF0cnFxZmhzY29reXV0bmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTgwNzEsImV4cCI6MjA4MTI3NDA3MX0.5BBt8TsEEG1FLZ2r3iNhDQEj_yyrQN2bJ7KTNIZWaJk';

export const storage = {
  getJobs: (): Job[] => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.JOBS) || '[]');
    } catch {
      return [];
    }
  },
  setJobs: (jobs: Job[]) => localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs)),
  
  getHistory: (): MatchResult[] => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]');
    } catch {
      return [];
    }
  },
  saveHistory: (results: MatchResult[]) => localStorage.setItem(KEYS.HISTORY, JSON.stringify(results)),

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
    let url = localStorage.getItem(KEYS.SUPABASE_URL);
    let key = localStorage.getItem(KEYS.SUPABASE_KEY);

    if (!url) {
        url = PRESET_SUPABASE_URL;
        localStorage.setItem(KEYS.SUPABASE_URL, url);
    }
    if (!key) {
        key = PRESET_SUPABASE_KEY;
        localStorage.setItem(KEYS.SUPABASE_KEY, key);
    }

    return { url, key };
  },
  setSupabaseConfig: (url: string, key: string) => {
    localStorage.setItem(KEYS.SUPABASE_URL, url.trim());
    localStorage.setItem(KEYS.SUPABASE_KEY, key.trim());
  }
};