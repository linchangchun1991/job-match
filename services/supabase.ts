import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';

/**
 * 动态获取 Supabase 客户端
 * 增加异常捕获，防止无效配置导致应用白屏
 */
export const getSupabase = (): SupabaseClient | null => {
  try {
    const { url, key } = storage.getSupabaseConfig();
    
    if (!url || !key || typeof url !== 'string' || !url.startsWith('http')) {
      console.warn("Supabase configuration is incomplete or invalid.");
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
    console.error("Critical error while creating Supabase client:", e);
    return null;
  }
};

export const isCloudEnabled = () => {
  const { url, key } = storage.getSupabaseConfig();
  return !!url && !!key && typeof url === 'string' && url.startsWith('http');
};