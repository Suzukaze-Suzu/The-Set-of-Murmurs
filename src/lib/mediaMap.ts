/**
 * ★ 2026-10-18「丁 · 把出口流量大头搬走」★ 图集/书封/头像的**本地副本清单**
 * ─────────────────────────────────────────────────────────────────────────────
 * 干什么用的：Supabase Storage 的公开对象（图集、书封、附件、头像图）每被取一次，
 * 就算一次项目出口流量。免费额度 5 GB 就是这么被吃掉的。把**文件本身**搬到站点自己
 * 的 `public/media/` 下（由 Vercel CDN 出，不走 Supabase），这块直接归零。
 *
 * 这个文件是**生成物**：`node first/egress-cut/pull-media.mjs` 会把 Storage 里的
 * 公开对象下载到 `public/media/<bucket>/<path>`，并重写这个映射表。
 * 键＝supabase 的 storage 路径（如 `/storage/v1/object/public/gallery/abc.jpg`），
 * 值＝站点内的静态地址（如 `/media/gallery/abc.jpg`）。
 *
 * `sbProxy()`（src/lib/sbUrl.ts）渲染时**先查这张表**：命中就用本地静态地址，
 * 没命中才回落到 `/api/sb?u=…` 同源代理。所以：
 *   · 表是空的 ⇒ 行为与今天完全一致（纯代理）；
 *   · 跑了 pull-media 之后 ⇒ 已搬走的图自动改走 CDN，**不用改任何业务代码、不用写库**。
 */
export const MEDIA_MAP: Record<string, string> = {};
