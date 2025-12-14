import { getSupabase, isCloudEnabled } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

export const jobService = {
  // 获取所有岗位
  fetchAll: async (): Promise<Job[]> => {
    const supabase = getSupabase();
    let jobs: Job[] = [];
    
    // 如果没有配置云端，降级使用本地存储
    if (!supabase) {
      jobs = storage.getJobs();
    } else {
        const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

        if (error || !data) {
            console.error('获取岗位失败:', error);
            // 失败时返回空数组，避免数据混淆
            jobs = [];
        } else {
            jobs = data.map((item: any) => ({
                id: item.id,
                company: item.company,
                location: item.location,
                type: item.type,
                requirement: item.requirement,
                title: item.title,
                updateTime: item.update_time,
                link: item.link
            }));
        }
    }

    // 关键修复：统一对所有字段进行清洗，防止历史坏数据（如回车符）导致显示错误
    return jobs.map(j => ({
      ...j,
      company: j.company?.trim(),
      title: j.title?.trim(),
      link: j.link ? j.link.trim() : undefined
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