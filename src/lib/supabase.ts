import { createClient } from '@supabase/supabase-js';

// Supabase 连接信息
// 注意：这些是公开的 Project URL 和 publishable/anon key，专为前端使用设计，安全可公开。
// 若需覆盖（如部署时注入环境变量），可设置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
