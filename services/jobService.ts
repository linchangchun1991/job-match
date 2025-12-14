import { getSupabase, isCloudEnabled } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

export const jobService = {
  // 获取所有岗位
  fetchAll: async (): Promise<Job[]> => {
    const supabase = getSupabase();
    
    // 如果没有配置云端，降级使用本地存储
    if (!supabase) {
      // 仅在控制台提示，避免打扰用户
      // console.warn('未配置Supabase，使用本地数据');
      return storage.getJobs();
    }

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取岗位失败:', error);
      // 如果云端失败，降级回本地？或者提示错误。这里选择提示错误并返回空，避免数据混淆。
      // 但为了体验，如果连接错，可以回退本地。不过这里为了严谨，我们返回空并打印错误。
      return [];
    }

    // 转换数据格式以匹配前端类型
    return data.map((item: any) => ({
      id: item.id,
      company: item.company,
      location: item.location,
      type: item.type,
      requirement: item.requirement,
      title: item.title,
      updateTime: item.update_time,
      link: item.link
    }));
  },

  // 批量上传岗位
  bulkInsert: async (jobs: Job[]): Promise<boolean> => {
    const supabase = getSupabase();

    if (!supabase) {
      const current = storage.getJobs();
      storage.setJobs([...current, ...jobs]);
      return true;
    }

    // 转换为数据库字段格式 (下划线命名)
    const dbRows = jobs.map(j => ({
      company: j.company,
      location: j.location,
      type: j.type,
      requirement: j.requirement,
      title: j.title,
      update_time: j.updateTime,
      link: j.link
    }));

    const { error } = await supabase
      .from('jobs')
      .insert(dbRows);

    if (error) {
      console.error('上传失败:', error);
      alert('上传失败: ' + error.message);
      return false;
    }
    return true;
  },

  // 清空岗位
  clearAll: async (): Promise<boolean> => {
    const supabase = getSupabase();

    if (!supabase) {
      storage.setJobs([]);
      return true;
    }

    const { error } = await supabase
      .from('jobs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有ID不为空的记录

    if (error) {
      console.error('清空失败:', error);
      return false;
    }
    return true;
  }
};