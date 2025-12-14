import { Job, MatchResult, MatchSession } from '../types';

const KEYS = {
  API_KEY: 'careermatch_api_key',
  JOBS: 'careermatch_jobs',
  // Deprecated legacy key
  HISTORY: 'careermatch_history',
  SESSIONS: 'careermatch_sessions'
};

// Hardcoded key as requested
const PRESET_API_KEY = 'sk-668c28bae516493d9ea8a3662118ec98';

export const storage = {
  getApiKey: (): string => {
    const stored = localStorage.getItem(KEYS.API_KEY);
    // Return stored key or fallback to preset
    if (!stored) {
      localStorage.setItem(KEYS.API_KEY, PRESET_API_KEY);
      return PRESET_API_KEY;
    }
    return stored;
  },
  setApiKey: (key: string) => localStorage.setItem(KEYS.API_KEY, key),
  
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
  }
};