import { getSupabase, isCloudEnabled } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

const META_SEPARATOR = ':::META:::';

interface UploadResult {
  success: boolean;
  message?: string;
}

interface ClearResult {
  success: boolean;
  message: string;
}

const formatError = (error: any): string => {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  const message = error.message || error.error_description || error.details;
  const hint = error.hint ? ` (提示: ${error.hint})` : '';
  const code = error.code ? ` [错误码: ${error.code}]` : '';
  if (message) return `${typeof message === 'object' ? JSON.stringify(message) : message}${hint}${code}`;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
};

const extractMetadata = (item: any) => {
    const potentialCarriers = ['type', 'description', 'location', 'tags', 'comment', 'memo', 'requirement', 'link'];
    for (const key of potentialCarriers) {
        const val = item[key];
        if (val && typeof val === 'string' && val.includes(META_SEPARATOR)) {
             const parts = val.split(META_SEPARATOR);
             return {
                 type: parts[0] || '',
                 requirement: parts[1] || '',
                 link: parts[2] || '',
                 updateTime: parts[3] || '',
                 location: parts[4] || ''
             };
        }
    }
    return {
        type: item.type || '',
        requirement: item.requirement || '',
        link: item.link || '', 
        updateTime: item.update_time || item.created_at?.split('T')[0] || '',
        location: item.location || '' 
    };
};

export const jobService = {
  fetchAll: async (): Promise<Job[]> => {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("Supabase not configured, using local storage.");
      return storage.getJobs();
    }
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase fetch error:", error);
        return storage.getJobs();
      }
      
      if (!data || data.length === 0) {
        console.info("Supabase table 'jobs' is empty.");
        return [];
      }

      return data.map((item: any) => {
          const meta = extractMetadata(item);
          return {
              id: String(item.id),
              company: (item.company || '未知公司').trim(),
              location: (meta.location || item.location || '全国').trim(), 
              type: meta.type,
              requirement: meta.requirement,
              title: (item.title || '通用岗').trim(),
              updateTime: meta.updateTime,
              link: meta.link || item.link 
          };
      });
    } catch (e) {
      console.error("Critical error fetching from Supabase:", e);
      return storage.getJobs();
    }
  },

  bulkInsert: async (jobs: Job[]): Promise<UploadResult> => {
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([...storage.getJobs(), ...jobs]);
      return { success: true };
    }

    const carriers = ['type', 'description', 'location', 'tags', 'comment'];
    let lastError = null;

    for (const carrier of carriers) {
        const dbRows = jobs.map(j => ({
            company: j.company,
            title: j.title,
            [carrier]: `${j.type || ''}${META_SEPARATOR}${j.requirement || ''}${META_SEPARATOR}${j.link || ''}${META_SEPARATOR}${j.updateTime || ''}${META_SEPARATOR}${j.location || ''}`
        }));

        const { error } = await supabase.from('jobs').insert(dbRows);
        if (!error) return { success: true };
        lastError = error;
        if (error.message?.includes('column')) continue;
        break;
    }
    return { success: false, message: formatError(lastError) };
  },

  clearAll: async (): Promise<ClearResult> => {
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([]);
      return { success: true, message: '本地数据库已重置' };
    }

    try {
      const { error, count } = await supabase
        .from('jobs')
        .delete({ count: 'exact' })
        .gt('id', -1);

      if (error) {
        const { error: retryError, count: retryCount } = await supabase
          .from('jobs')
          .delete({ count: 'exact' })
          .neq('company', 'FORCE_DELETE_ALL_SHIFTS_123');
        
        if (retryError) return { success: false, message: formatError(retryError) };
        return { success: true, message: `已从云端移除 ${retryCount || 0} 条岗位` };
      }
      
      return { success: true, message: `已从云端移除 ${count || 0} 条岗位` };
    } catch (e: any) {
      return { success: false, message: formatError(e) };
    }
  }
};