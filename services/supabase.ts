
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';

/**
 * 动态获取 Supabase 客户端
 * 逻辑：环境变量(全局) > 本地存储(个人自定义)
 */
export const getSupabase = (): SupabaseClient | null => {
  try {
    // 1. 优先尝试从系统环境变量获取（用于全员共享）
    let url = process.env.SUPABASE_URL;
    let key = process.env.SUPABASE_KEY;

    // 2. 如果环境变量没有，再从本地存储获取
    if (!url || !key) {
      const config = storage.getSupabaseConfig();
      url = config.url;
      key = config.key;
    }
    
    if (!url || !key || typeof url !== 'string' || !url.startsWith('http')) {
      return null;
    }

    // 确保 URL 是有效的格式
    new URL(url);
    
    return createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  } catch (e) {
    console.error("Supabase 初始化失败:", e);
    return null;
  }
};

export const isCloudEnabled = () => {
  const supabase = getSupabase();
  return !!supabase;
};
