
import { getSupabase } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
}

export const jobService = {
  fetchAll: async (): Promise<Job[]> => {
    const supabase = getSupabase();
    if (!supabase) return storage.getJobs();
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        id: String(item.id),
        company: item.company || '未知公司',
        title: item.title || '招聘岗位',
        location: item.location || '全国', 
        requirement: item.requirement || '',
        link: item.link || item.url || '',
        updateTime: item.created_at?.split('T')[0] || '',
        type: item.type || ''
      }));
    } catch (e: any) {
      console.error("Cloud fetch error:", e);
      // 如果云端失败，返回本地缓存作为兜底，但在 UI 提示
      return storage.getJobs();
    }
  },

  bulkInsert: async (jobs: Job[]): Promise<SyncResult> => {
    const supabase = getSupabase();
    
    if (!supabase) {
      const existing = storage.getJobs();
      const updated = [...jobs, ...existing].slice(0, 1000);
      storage.setJobs(updated);
      return { success: true, message: "⚠️ 未配置云数据库，已保存至本地存储", count: jobs.length };
    }

    try {
      const rows = jobs.map(j => ({
        company: j.company,
        title: j.title,
        location: j.location,
        link: j.link || '',
        requirement: j.requirement || '',
        type: j.type || ''
      }));

      const { error } = await supabase.from('jobs').insert(rows);
      
      if (error) {
        return { 
          success: false, 
          message: `云端同步失败: ${error.message} (代码: ${error.code})。请确保已在 Supabase 运行建表 SQL。` 
        };
      }

      return { success: true, message: "✅ 云端同步成功！", count: jobs.length };
    } catch (e: any) {
      return { success: false, message: `同步异常: ${e.message}` };
    }
  },

  clearAll: async (): Promise<SyncResult> => {
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([]);
      return { success: true, message: '本地存储已清空' };
    }

    try {
      // 这里的逻辑需要 RLS 策略支持 DELETE
      const { error } = await supabase.from('jobs').delete().neq('id', -1);
      if (error) throw error;
      return { success: true, message: '云端数据库已清空' };
    } catch (e: any) {
      return { success: false, message: `清空失败: ${e.message}` };
    }
  }
};
