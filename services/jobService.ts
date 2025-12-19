
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
    if (!supabase) {
      console.warn("Cloud not available, using local cache.");
      return storage.getJobs();
    }
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        return storage.getJobs();
      }
      
      return (data || []).map((item: any) => ({
        id: String(item.id),
        company: item.company || '未知公司',
        title: item.title || '招聘岗位',
        location: item.location || '全国', 
        requirement: item.requirement || '',
        link: item.link || '', 
        updateTime: item.created_at?.split('T')[0] || '',
        type: item.type || ''
      }));
    } catch (e: any) {
      return storage.getJobs();
    }
  },

  bulkInsert: async (jobs: Job[]): Promise<SyncResult> => {
    const supabase = getSupabase();
    
    if (!supabase) {
      const existing = storage.getJobs();
      const updated = [...jobs, ...existing].slice(0, 1000);
      storage.setJobs(updated);
      return { success: true, message: "⚠️ 离线模式：已存入本地浏览器缓存", count: jobs.length };
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
        if (error.code === 'PGRST204' || error.message.includes('column')) {
          return { 
            success: false, 
            message: `字段缺失：请在【设置】中复制脚本并在国内云 SQL 编辑器运行。` 
          };
        }
        return { 
          success: false, 
          message: `同步失败: ${error.message}` 
        };
      }

      return { success: true, message: "🚀 国内云同步成功！岗位已入库。", count: jobs.length };
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
      const { error } = await supabase.from('jobs').delete().neq('id', -1);
      if (error) throw error;
      return { success: true, message: '国内云岗位库已完全清空' };
    } catch (e: any) {
      return { success: false, message: `清空失败: ${e.message}` };
    }
  }
};
