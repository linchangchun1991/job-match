import { getSupabase, isCloudEnabled } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

const META_SEPARATOR = ':::META:::';

interface UploadResult {
  success: boolean;
  message?: string;
}

const formatError = (error: any): string => {
  if (!error) return '未知错误';
  return error.message || JSON.stringify(error);
};

export const jobService = {
  fetchAll: async (): Promise<Job[]> => {
    const supabase = getSupabase();
    if (!supabase) return storage.getJobs();
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
          id: String(item.id),
          company: (item.company || '未知公司').trim(),
          title: (item.title || '岗位').trim(),
          location: (item.location || '全国').trim(), 
          requirement: item.requirement || '',
          link: item.link || '',
          updateTime: item.created_at?.split('T')[0] || '',
          type: item.type || ''
      }));
    } catch (e) {
      console.error("Supabase fetch failed, falling back to local:", e);
      return storage.getJobs();
    }
  },

  bulkInsert: async (jobs: Job[]): Promise<UploadResult> => {
    if (jobs.length === 0) return { success: true, message: "没有待同步的数据" };
    
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([...storage.getJobs(), ...jobs]);
      return { success: true };
    }

    // 尝试完整字段插入
    const fullRows = jobs.map(j => ({
      company: j.company,
      title: j.title,
      location: j.location,
      link: j.link,
      requirement: j.requirement,
      type: j.type
    }));

    const { error: fullError } = await supabase.from('jobs').insert(fullRows);
    
    if (!fullError) return { success: true };

    // 如果报错是因为字段缺失（例如没有 type 字段），尝试极简字段插入（仅 company 和 title）
    console.warn("完整插入失败，尝试极简模式插入...", fullError.message);
    
    const simpleRows = jobs.map(j => ({
      company: j.company,
      title: j.title
    }));

    const { error: simpleError } = await supabase.from('jobs').insert(simpleRows);
    
    if (!simpleError) return { success: true, message: "已通过兼容模式同步成功" };
    
    return { success: false, message: formatError(simpleError) };
  },

  clearAll: async (): Promise<{ success: boolean; message: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([]);
      return { success: true, message: '本地已清空' };
    }

    const { error } = await supabase.from('jobs').delete().neq('id', -1);
    if (error) return { success: false, message: formatError(error) };
    return { success: true, message: '云端已清空' };
  }
};