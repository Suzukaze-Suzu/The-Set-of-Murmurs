import { createClient } from '@supabase/supabase-js';

// Supabase 连接信息
// 注意：这些是公开的 Project URL 和 publishable/anon key，专为前端使用设计，安全可公开。
// 若需覆盖（如部署时注入环境变量），可设置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';

/**
 * 2026-10-09「留言板发表不了了」那一轮加的**统一超时**。
 * ─────────────────────────────────────────────────────────────────────────────
 * 病根：国内直连 supabase 时连接会被掐（实测 node 侧 15 次里挂 3 次；浏览器侧更凶），
 * 而 supabase-js 的 fetch **默认没有超时**——被掐住的那次请求会一直挂着，
 * 于是「发表」按钮按下去既不成功也不失败，用户看到的就是「没反应」。
 * 这里给所有 supabase 请求（含 auth 的）套一个 20 秒上限：到点就变成一次
 * 「Failed to fetch / aborted」错误，界面才有机会把它显示出来。
 * 20 秒是给慢链路留的余量（实测正常一次往返 0.2～3 秒）。
 */
const TIMEOUT_MS = 20000;

/**
 * ★ 2026-10-15「只有快照在，没有内容」★
 * ─────────────────────────────────────────────────────────────────────────────
 * 病根：前端所有实时内容都是**浏览器直连** supabase.co 取的，而墙内这条腿被掐
 * （本机 node 实测 ECONNRESET / 234ms，浏览器侧更凶）。于是 HTML 能打开（墙内到
 * Vercel 是通的：首页实测 200 / 366ms），React 挂载后取数失败 → 页面只剩构建期
 * 预渲染快照。用户原话：「只有快照在，没有内容」。
 *
 * 解法：把所有对 Supabase 的请求改打到**同源** `/api/sb?u=…`，由 Vercel Function
 * （`api/sb.mjs`）代转 —— 和 2026-10-13 网易云那次 `api/ncm.mjs` 同一条路。
 *
 * 只改这一个函数 → REST / auth / storage 三条线全覆盖，业务代码一行都不用动。
 * 注意：目标地址只做**前缀替换**，query 与百分号编码原样保留。
 *
 * ★ 2026-10-18：为什么目标路径在 `?u=` 里、而不是 `/api/sb/<路径>` ★
 *   原写法 `api/sb/[...path].mjs` 在 Vercel 上**没被当 catch-all**：线上实测
 *   `/api/sb/x`（一段）命中本函数、`/api/sb/rest/v1/articles`（多段）直接吃平台 404。
 *   于是所有取数请求全 404 → 首屏永远空 → 用户报「连快照都打不开了」。
 *   改成查询参数后，路由只认精确的 `/api/sb`，不再依赖动态路由语义。
 */
const PROXY_BASE = '/api/sb';

/**
 * ★ 2026-10-18「丁」：匿名读与登入读必须落**不同的缓存键** ★
 * ─────────────────────────────────────────────────────────────────────────────
 * 后端（`api/sb.mjs`）现在给**匿名** `GET /rest/v1/*` 加边缘缓存（s-maxage=300），
 * 因为每次访问都把整个留言板 + 全站评论（含 base64 头像）重下一遍是 5 GB 免费额度的
 * 大头。但边缘缓存只按 URL 分桶——博主带着会话读时若和匿名读同一个 URL，
 * 就可能拿到**别人的匿名缓存**（表现：权限时有时无、昵称/头像串号）。
 * 所以：只要这个浏览器里有会话，URL 就多带一个外层参数 `_r=auth`，把两条线分开。
 * `_r` 只活在 /api/sb 自己的查询串里（handler 只取 `u=`），不会转发给 Supabase。
 *
 * 用 localStorage 判有没有会话：**同步、零网络**（supabase-js 把会话存在
 * `sb-<projectRef>-auth-token`，token 太长时会分块成 `.0`/`.1`）。不靠 request 头推断，
 * 因为取数可能发生在 auth 还没 hydrate 完的那一刻。
 */
const PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0];
  } catch {
    return '';
  }
})();

function hasLocalSession(): boolean {
  try {
    const base = `sb-${PROJECT_REF}-auth-token`;
    const ls = window.localStorage;
    return !!(ls.getItem(base) || ls.getItem(base + '.0'));
  } catch {
    return false;
  }
}

function toSameOriginUrl(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (raw.startsWith(SUPABASE_URL)) {
    const target = raw.slice(SUPABASE_URL.length);
    // 只编码一次：u 的值就是 supabase 原始路径+查询（它自己的百分号编码原样保留）
    let url = PROXY_BASE + '?u=' + encodeURIComponent(target);
    // 图片/静态对象是纯公开资源：不加标记，让它们继续吃 86400 的边缘缓存
    if (!target.startsWith('/storage/v1/') && hasLocalSession()) url += '&_r=auth';
    return url;
  }
  return raw;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(toSameOriginUrl(input), { ...init, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) }),
  },
});
