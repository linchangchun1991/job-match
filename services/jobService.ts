
import { storage } from './storage';
import { Job } from '../types';

interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
}

// 获取 API 地址，优先使用环境变量，其次使用本地存储
const getApiUrl = () => {
  // @ts-ignore
  let url = process.env.SUPABASE_URL || localStorage.getItem('careermatch_supabase_url');
  if (url && url.endsWith('/')) url = url.slice(0, -1);
  return url;
};

export const jobService = {
  fetchAll: async (): Promise<Job[]> => {
    const baseUrl = getApiUrl();
    
    // 如果没有配置 URL，直接返回本地缓存
    if (!baseUrl) {
      console.warn("Offline Mode: No API URL configured.");
      return storage.getJobs();
    }
    
    try {
      // 适配 PostgREST 的查询语法：按 ID 倒序
      const response = await fetch(`${baseUrl}/jobs?order=id.desc`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
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
      console.error("Fetch failed, falling back to local:", e);
      return storage.getJobs();
    }
  },

  bulkInsert: async (jobs: Job[]): Promise<SyncResult> => {
    const baseUrl = getApiUrl();
    
    if (!baseUrl) {
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

      const response = await fetch(`${baseUrl}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation' // 让 PostgREST 返回插入的数据
        },
        body: JSON.stringify(rows)
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 404) {
           return { success: false, message: "连接失败：请检查 API 地址是否正确，或数据库表是否存在。" };
        }
        return { success: false, message: `同步失败 (${response.status}): ${errText.slice(0, 100)}` };
      }

      return { success: true, message: "🚀 云端同步成功！岗位已入库。", count: jobs.length };
    } catch (e: any) {
      return { success: false, message: `网络异常: ${e.message}` };
    }
  },

  clearAll: async (): Promise<SyncResult> => {
    const baseUrl = getApiUrl();
    if (!baseUrl) {
      storage.setJobs([]);
      return { success: true, message: '本地存储已清空' };
    }

    try {
      // PostgREST 删除所有数据需要明确的条件，这里用 id > 0
      const response = await fetch(`${baseUrl}/jobs?id=gt.0`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(response.statusText);
      return { success: true, message: '云端岗位库已清空' };
    } catch (e: any) {
      return { success: false, message: `清空失败: ${e.message}` };
    }
  }
};
