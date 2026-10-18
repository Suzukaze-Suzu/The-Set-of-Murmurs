import { SUPABASE_URL } from './supabase';

/**
 * ★ 2026-10-15：把指向 Supabase 的**绝对地址**换成同源 `/api/sb/...` ★
 * ─────────────────────────────────────────────────────────────────────────────
 * 背景见 `lib/supabase.ts` 顶部与 `api/sb/[...path].mjs`：墙内浏览器直连 supabase.co
 * 会被掐，所以数据与图片都改从本站同源走（Vercel Function 代转）。
 *
 * ⚠️ 铁律：**只用于渲染**（`<img src>` / `<a href>`），绝不能用在写库的路径上——
 * `Write.tsx` / `NovelComposer.tsx` / `GalleryContext` 里编辑态拿到的仍必须是绝对地址，
 * 否则保存时会把 `/api/sb/...` 写回数据库，污染存量内容。
 */
export const SB_PROXY_BASE = '/api/sb';

/** 绝对 supabase 地址 → 同源代理地址；其它地址原样返回（no-op）。 */
export function sbProxy(url?: string | null): string {
  if (!url) return '';
  return url.startsWith(SUPABASE_URL) ? SB_PROXY_BASE + url.slice(SUPABASE_URL.length) : url;
}
