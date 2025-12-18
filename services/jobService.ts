
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

/**
 * 核心修复：彻底解决 [object Object] 问题
 * 确保任何输入都能转化为人类可读的字符串
 */
const formatError = (error: any): string => {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  
  // 1. 尝试从 Supabase 标准错误结构中提取
  const message = error.message || error.error_description || error.details;
  const hint = error.hint ? ` (提示: ${error.hint})` : '';
  const code = error.code ? ` [错误码: ${error.code}]` : '';

  if (message) {
    return `${typeof message === 'object' ? JSON.stringify(message) : message}${hint}${code}`;
  }

  // 2. 尝试从原生 Error 对象中提取
  if (error instanceof Error) {
    return error.message;
  }

  // 3. 最后的兜底：强制序列化
  try {
    const stringified = JSON.stringify(error);
    if (stringified === '{}') return error.toString() || '无法解析的错误对象';
    return stringified;
  } catch (e) {
    return '系统发生异常，且无法解析错误详情';
  }
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
    if (!supabase) return storage.getJobs();
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    
    return (data || []).map((item: any) => {
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
      /**
       * 修复核心：
       * 之前使用 UUID 字符串导致 bigint 类型的 ID 报错。
       * 改用 .gt('id', 0) 或 .neq('id', -1)，这两个条件对数字类型 ID 始终有效，
       * 且能成功触发 Supabase 的全表删除逻辑。
       */
      const { error, count } = await supabase
        .from('jobs')
        .delete({ count: 'exact' })
        .gt('id', -1); // 兼容 bigint 和 UUID，因为 ID 肯定大于 -1

      if (error) {
        // 如果 gt 还是报错（极少数 UUID 情况），尝试使用不等于一个不可能的数字
        const { error: retryError, count: retryCount } = await supabase
          .from('jobs')
          .delete({ count: 'exact' })
          .neq('company', 'THIS_WILL_NEVER_MATCH_ANYTHING_12345');
        
        if (retryError) return { success: false, message: formatError(retryError) };
        return { success: true, message: `已从云端移除 ${retryCount || 0} 条岗位` };
      }
      
      return { success: true, message: `已从云端移除 ${count || 0} 条岗位` };
    } catch (e: any) {
      return { success: false, message: formatError(e) };
    }
  }
};
