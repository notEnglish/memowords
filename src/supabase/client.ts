// ============================================================
// MemoWords — Supabase 客户端初始化
// ============================================================

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export function getSupabaseClient() {
  return supabase;
}
