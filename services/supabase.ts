import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';

// 不再使用硬编码，改为动态获取
export const getSupabase = (): SupabaseClient | null => {
  const { url, key } = storage.getSupabaseConfig();
  
  if (!url || !key || !url.startsWith('http')) {
    return null;
  }

  try {
    return createClient(url, key);
  } catch (e) {
    console.error("Invalid Supabase config", e);
    return null;
  }
};

export const isCloudEnabled = () => {
  const { url, key } = storage.getSupabaseConfig();
  return !!url && !!key && url.startsWith('http');
};