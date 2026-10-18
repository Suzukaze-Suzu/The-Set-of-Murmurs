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
 * 解法：把所有对 Supabase 的请求改打到**同源** `/api/sb/*`，由 Vercel Function
 * （`api/sb/[...path].mjs`）代转 —— 和 2026-10-13 网易云那次 `api/ncm.mjs` 同一条路。
 *
 * 只改这一个函数 → REST / auth / storage 三条线全覆盖，业务代码一行都不用动。
 * 注意：目标地址只做**前缀替换**，query 与百分号编码原样保留。
 */
const PROXY_BASE = '/api/sb';

function toSameOriginUrl(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (raw.startsWith(SUPABASE_URL)) return PROXY_BASE + raw.slice(SUPABASE_URL.length);
  return raw;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(toSameOriginUrl(input), { ...init, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) }),
  },
});
