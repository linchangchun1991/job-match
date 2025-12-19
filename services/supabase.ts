
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 生产级 Supabase 客户端初始化
 */
export const getSupabase = (): SupabaseClient | null => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    // 调试日志（生产环境建议关闭，调试期开启）
    if (!url || !key) {
      console.warn("Supabase Config Missing: URL or KEY is undefined in process.env");
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
    console.error("Supabase Initialization Error:", e);
    return null;
  }
};

export const isCloudEnabled = () => {
  const supabase = getSupabase();
  if (!supabase) return false;
  return true;
};
