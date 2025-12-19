
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 生产级 Supabase 客户端初始化
 * 逻辑：仅使用预设的环境变量，确保“零配置”体验。
 */
export const getSupabase = (): SupabaseClient | null => {
  try {
    // 严格从 Vite/Zeabur 注入的环境变量中读取
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    if (!url || !key || !url.startsWith('http')) {
      console.error("CRITICAL: 系统预置数据库配置缺失，请检查环境变量设置。");
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
    console.error("Supabase 初始化失败:", e);
    return null;
  }
};

export const isCloudEnabled = () => {
  const supabase = getSupabase();
  return !!supabase;
};
