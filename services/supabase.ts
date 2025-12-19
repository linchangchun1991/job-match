
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';

export const getSupabase = (): SupabaseClient | null => {
  try {
    // 优先从本地存储读取（用户手动配置）
    const config = storage.getSupabaseConfig();
    let url = config.url;
    let key = config.key;

    // 其次从环境变量读取（系统自动注入）
    if (!url || !key) {
      url = process.env.SUPABASE_URL || '';
      key = process.env.SUPABASE_KEY || '';
    }
    
    if (!url || !key || !url.startsWith('http')) {
      return null;
    }

    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  } catch (e) {
    console.error("Supabase 客户端初始化异常:", e);
    return null;
  }
};

export const isCloudEnabled = () => {
  const supabase = getSupabase();
  return !!supabase;
};
