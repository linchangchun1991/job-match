import { getSupabase, isCloudEnabled } from './supabase';
import { Job } from '../types';
import { storage } from './storage';

const META_SEPARATOR = ':::META:::';

interface UploadResult {
  success: boolean;
  message?: string;
}

// 提取并解析元数据
const extractMetadata = (item: any) => {
    // 优先检查可能包含打包数据的字段
    const potentialCarriers = ['type', 'description', 'location', 'tags', 'comment', 'memo', 'requirement', 'link'];
    
    for (const key of potentialCarriers) {
        const val = item[key];
        if (val && typeof val === 'string' && val.includes(META_SEPARATOR)) {
             const parts = val.split(META_SEPARATOR);
             // 协议格式: Type ::: Req ::: Link ::: UpdateTime ::: Location
             return {
                 type: parts[0] || '',
                 requirement: parts[1] || '',
                 link: parts[2] || '',
                 updateTime: parts[3] || '',
                 location: parts[4] || '' // 如果 location 也在包里，优先使用
             };
        }
    }
    
    // 如果没有发现打包数据，尝试从原始字段读取（向后兼容）
    return {
        type: item.type || '',
        requirement: item.requirement || '',
        link: item.link || '',
        updateTime: item.update_time || item.created_at?.split('T')[0] || '',
        location: item.location || ''
    };
};

export const jobService = {
  // 获取所有岗位
  fetchAll: async (): Promise<Job[]> => {
    const supabase = getSupabase();
    let jobs: Job[] = [];
    
    if (!supabase) {
      jobs = storage.getJobs();
    } else {
        const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

        if (error || !data) {
            console.error('获取岗位失败:', error);
            jobs = [];
        } else {
            jobs = data.map((item: any) => {
                const meta = extractMetadata(item);
                
                // 二次兼容旧的 LINK 打包格式
                if (meta.requirement && meta.requirement.includes(':::LINK:::')) {
                    const parts = meta.requirement.split(':::LINK:::');
                    meta.requirement = parts[0];
                    if (!meta.link) meta.link = parts[1];
                }

                return {
                    id: item.id,
                    company: item.company,
                    location: meta.location, 
                    type: meta.type,
                    requirement: meta.requirement,
                    title: item.title,
                    updateTime: meta.updateTime,
                    link: meta.link
                };
            });
        }
    }

    return jobs.map(j => ({
      ...j,
      company: j.company?.trim(),
      title: j.title?.trim(),
      link: j.link ? j.link.trim() : undefined
    }));
  },

  // 批量上传岗位
  bulkInsert: async (jobs: Job[]): Promise<UploadResult> => {
    const supabase = getSupabase();

    if (!supabase) {
      const current = storage.getJobs();
      storage.setJobs([...current, ...jobs]);
      return { success: true };
    }

    // 自动适应字段策略：依次尝试可能的字段作为数据容器
    // 避免因数据库缺少 type, requirement, link 等字段导致上传失败
    const carriers = ['type', 'description', 'location', 'tags', 'comment'];
    let lastError = null;

    for (const carrier of carriers) {
        const dbRows = jobs.map(j => {
             // 构造全能数据包: Type ::: Req ::: Link ::: UpdateTime ::: Location
            const packedData = `${j.type || ''}${META_SEPARATOR}${j.requirement || ''}${META_SEPARATOR}${j.link || ''}${META_SEPARATOR}${j.updateTime || ''}${META_SEPARATOR}${j.location || ''}`;
            
            return {
                company: j.company,
                title: j.title,
                [carrier]: packedData // 动态使用字段
            };
        });

        const { error } = await supabase.from('jobs').insert(dbRows);
        
        if (!error) {
            return { success: true };
        }

        lastError = error;
        // 如果错误是"找不到列"，则尝试下一个字段
        if (error.message.includes('Could not find the') && error.message.includes('column')) {
            console.warn(`Upload attempt with column '${carrier}' failed, retrying next candidate...`);
            continue; 
        }

        // 如果是权限或其他错误，直接中断
        break;
    }

    // 处理最终错误
    let msg = lastError?.message || 'Unknown error';
    if (msg.includes('row-level security')) {
        msg = '权限不足 (RLS)。请在 Supabase 后台关闭 jobs 表的 RLS 或添加 Insert 策略。';
    } else if (msg.includes('value too long')) {
        msg = '字段内容过长，请检查数据库字段类型 (建议 TEXT)。';
    } else if (msg.includes('column')) {
        msg = `数据库严重不兼容，找不到可用字段 (尝试了: ${carriers.join(', ')})。请检查表结构是否包含 company 和 title。`;
    }

    return { success: false, message: msg };
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
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('清空失败:', error);
      return false;
    }
    return true;
  }
};