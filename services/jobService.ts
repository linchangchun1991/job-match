
import { getSupabase, isCloudEnabled } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

interface UploadResult {
  success: boolean;
  message?: string;
}

const formatError = (error: any): string => {
  if (!error) return '未知错误';
  return error.message || JSON.stringify(error);
};

export const jobService = {
  /**
   * 获取所有岗位：增加了字段“容错抓取”逻辑
   */
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
      
      return (data || []).map((item: any) => {
          // 智能探测链接字段：优先 link，其次 url 或 application_link
          const detectedLink = item.link || item.url || item.application_link || item.applicationLink || '';
          
          return {
            id: String(item.id),
            company: (item.company || '未知公司').trim(),
            title: (item.title || '岗位').trim(),
            location: (item.location || '全国').trim(), 
            requirement: item.requirement || '',
            link: String(detectedLink).trim(),
            updateTime: item.created_at?.split('T')[0] || '',
            type: item.type || ''
          };
      });
    } catch (e) {
      console.error("Supabase 数据读取失败:", e);
      return storage.getJobs();
    }
  },

  /**
   * 批量插入：严格对接 link 字段
   */
  bulkInsert: async (jobs: Job[]): Promise<UploadResult> => {
    if (jobs.length === 0) return { success: true, message: "没有待同步的数据" };
    
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([...storage.getJobs(), ...jobs]);
      return { success: true };
    }

    // 核心字段映射
    const rowsToInsert = jobs.map(j => ({
      company: j.company,
      title: j.title,
      location: j.location,
      link: j.link || '', // 对应 SQL 中的 link 列
      requirement: j.requirement || '',
      type: j.type || ''
    }));

    // 执行插入
    const { error: insertError } = await supabase.from('jobs').insert(rowsToInsert);
    
    if (insertError) {
      console.error("插入失败:", insertError);
      
      // 尝试极端简化模式（只保公司、岗位、链接）
      const minimalRows = jobs.map(j => ({
        company: j.company,
        title: j.title,
        link: j.link || ''
      }));
      
      const { error: minError } = await supabase.from('jobs').insert(minimalRows);
      
      if (minError) {
        return { 
          success: false, 
          message: `同步失败！请确认已在 Supabase SQL Editor 运行过修复命令。错误: ${formatError(minError)}` 
        };
      }
      
      return { success: true, message: "通过兼容模式同步成功（部分字段已忽略）" };
    }

    return { success: true };
  },

  /**
   * 清空数据库
   */
  clearAll: async (): Promise<{ success: boolean; message: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      storage.setJobs([]);
      return { success: true, message: '本地已清空' };
    }

    // Supabase 不允许无条件删除，通过删除 id 不等于 -1 的所有行来实现清空
    const { error } = await supabase.from('jobs').delete().neq('id', -1);
    if (error) return { success: false, message: formatError(error) };
    return { success: true, message: '云端已清空' };
  }
};
