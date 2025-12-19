
// 这个文件保留是为了兼容性，但现在我们主要使用原生 fetch
export const isCloudEnabled = () => {
  // @ts-ignore
  const url = process.env.SUPABASE_URL || localStorage.getItem('careermatch_supabase_url');
  return !!url && url.length > 5;
};

// 导出空对象以防其他文件引用报错，实际上已不再使用 supabase 客户端
export const getSupabase = () => null;
