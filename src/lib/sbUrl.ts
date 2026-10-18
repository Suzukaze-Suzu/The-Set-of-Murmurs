import { SUPABASE_URL } from './supabase';
import { MEDIA_MAP } from './mediaMap';

/**
 * ★ 2026-10-15：把指向 Supabase 的**绝对地址**换成同源 `/api/sb?u=…` ★
 * ─────────────────────────────────────────────────────────────────────────────
 * 背景见 `lib/supabase.ts` 顶部与 `api/sb.mjs`：墙内浏览器直连 supabase.co
 * 会被掐，所以数据与图片都改从本站同源走（Vercel Function 代转）。
 *
 * ★ 2026-10-18：路径段 → 查询参数 ★
 *   原写法 `/api/sb/<路径>` 依赖 Vercel 的 catch-all（`api/sb/[...path].mjs`），实测线上
 *   多段路径吃 404（只匹配一段），整站取数全挂。现在目标路径整体放进 `?u=`
 *   （`encodeURIComponent` 一次，supabase 自己的百分号编码原样保留）。
 *
 * ⚠️ 铁律：**只用于渲染**（`<img src>` / `<a href>`），绝不能用在写库的路径上——
 * `Write.tsx` / `NovelComposer.tsx` / `GalleryContext` 里编辑态拿到的仍必须是绝对地址，
 * 否则保存时会把 `/api/sb?u=...` 写回数据库，污染存量内容。
 */
export const SB_PROXY_BASE = '/api/sb';

/** 绝对 supabase 地址 → 同源代理地址；其它地址原样返回（no-op）。
 *  ★ 2026-10-18「丁」：先查 `MEDIA_MAP`（已搬到 `public/media/` 的静态副本）。
 *  命中 ⇒ 直接走站点自己的 CDN，**不再为这张图付 Supabase 出口流量**。 */
export function sbProxy(url?: string | null): string {
  if (!url) return '';
  if (!url.startsWith(SUPABASE_URL)) return url;
  const target = url.slice(SUPABASE_URL.length);
  const local = MEDIA_MAP[target];
  if (local) return local;
  return SB_PROXY_BASE + '?u=' + encodeURIComponent(target);
}
