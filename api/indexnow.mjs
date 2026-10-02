// Vercel Serverless Function：IndexNow 主动推送（把新文章/更新直接通知 Bing 等搜索引擎）
// 部署位置：api/ 目录下的文件自动成为 /api/xxx 接口（Vercel Functions）。
//
// 为什么需要它：
//   Bing 的 URL 会被「发现」（从 sitemap / 链接里看到），但**抓取是它自己排队的**，
//   新站没有外链 → 优先级极低 → 后台长期停在「已发现但未爬网」。
//   IndexNow 是 Bing / Yandex / Seznam / Naver 共用的即时提交协议：POST 一下，
//   这些引擎立刻把 URL 放进抓取队列，不用等它自己排到。
//   走 api.indexnow.org（协议官方通用入口）→ 一次提交，参与该协议的引擎全都收到。
//
// 身份文件（IndexNow 的所有权校验方式）：
//   站点根目录的 /indexnow-key.txt，文件名与内容同为这个 key。
//   key 本身不是机密（它必须公开可访问，验证用），所以直接写在这里。
//
// 鉴权：只有博主能调。前端带 Supabase access token，
//   服务端用 service role 调 auth/v1/user 拿到 user.id，与 ADMIN_UUID 比对。
//   环境变量沿用 api/comment-notify.mjs 已在用的那套（Vercel → Settings → Environment Variables）：
//   - SUPABASE_URL（或 VITE_SUPABASE_URL）
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SITE_URL（可选，默认 https://www.the-set-of-murmurs.me）

const INDEXNOW_KEY = '9c2521104a94ff37153bc2962e32991c';
const ADMIN_UUID = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'; // 与 src/context/AuthContext.tsx 保持一致
const ANON_KEY_FALLBACK = 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';

const SITE_URL = (process.env.SITE_URL || 'https://www.the-set-of-murmurs.me').replace(/\/+$/, '');
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
const SITEMAP = `${SITE_URL}/sitemap.xml`;
// IndexNow 端点，**按顺序依次尝试**（实测 2026-10-01：api.indexnow.org 从国内部署环境不一定连得上，
// 而 www.bing.com/indexnow 通、返回 202）。
// 提交给任一端点都等于通知 Bing（这是该协议的本职），所以第一个通了就够用。
// 可用 INDEXNOW_ENDPOINT 覆盖（逗号分隔多个），本地测试用。
const INDEXNOW_ENDPOINTS = (process.env.INDEXNOW_ENDPOINT
  || 'https://www.bing.com/indexnow,https://api.indexnow.org/indexnow,https://yandex.com/indexnow')
  .split(',').map((s) => s.trim()).filter(Boolean);

// 简易限流：同 IP 60 秒内最多 3 次（够手动用；防被人拿去当提交机刷）
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.INDEXNOW_RATE_MAX || 3);
const hitLog = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hitLog.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return true;
  arr.push(now);
  hitLog.set(ip, arr);
  if (hitLog.size > 500) {
    for (const [k, v] of hitLog) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hitLog.delete(k);
    }
  }
  return false;
}

function normUrl(u) {
  try {
    const url = new URL(String(u).trim());
    if (url.host !== SITE_HOST && url.host !== SITE_HOST.replace(/^www\./, '')) return null;
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchText(url, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function callerId(req, supabaseUrl, serviceKey) {
  // 本地测试钩子：INDEXNOW_TEST_UID 只在开发机设置，Vercel 上不存在 → 生产无影响。
  // 用途：本地 mock server 能跑通 401 / 403 / 200 三条分支，不必拿到 service role key。
  if (process.env.INDEXNOW_TEST_UID) return process.env.INDEXNOW_TEST_UID;
  const raw = req.headers.authorization || req.headers.Authorization || '';
  const token = String(raw).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey || process.env.SUPABASE_ANON_KEY || ANON_KEY_FALLBACK,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) return null;
  const user = await r.json().catch(() => null);
  return user?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    || 'https://ghzcvuemtoqejyciirks.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let uid = null;
  try {
    uid = await callerId(req, supabaseUrl, serviceKey);
  } catch (err) {
    console.error('[indexnow] 鉴权请求失败：', err?.message || err);
    return res.status(502).json({ error: 'AuthCheckFailed', detail: '无法连接 Supabase 校验身份' });
  }
  if (!uid) return res.status(401).json({ error: 'Unauthorized', detail: '请先登录博主账号' });
  if (uid !== ADMIN_UUID) return res.status(403).json({ error: 'Forbidden', detail: '只有博主能推送' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'TooManyRequests', detail: '太频繁了，等 1 分钟再推' });
  }

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const mode = body.mode || 'items';

  let urls = [];
  const skipped = [];

  if (mode === 'all') {
    // 全站：直接读线上 sitemap，保证和已收录的清单一致
    try {
      const sm = await fetchText(SITEMAP);
      if (sm.status !== 200) {
        return res.status(502).json({ error: 'SitemapFetchFailed', detail: `sitemap 返回 ${sm.status}` });
      }
      urls = [...sm.text.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((m) => normUrl(m[1])).filter(Boolean);
    } catch (err) {
      return res.status(502).json({ error: 'SitemapFetchFailed', detail: err?.message || String(err) });
    }
  } else {
    // 指定文章：urls 由前端按「中文 + 英文」两条传进来
    const raw = Array.isArray(body.urls) ? body.urls : [];
    for (const u of raw) {
      const n = normUrl(u);
      if (n) urls.push(n);
      else skipped.push(String(u));
    }
    // 首页一并捎上（文章更新时首页列表也变了）
    if (body.includeHome !== false) {
      const home = normUrl(`${SITE_URL}/`);
      if (home && !urls.includes(home)) urls.push(home);
    }
  }

  urls = [...new Set(urls)];
  if (urls.length === 0) {
    return res.status(200).json({ ok: false, error: 'NoValidUrl', skipped });
  }
  if (urls.length > 10000) urls = urls.slice(0, 10000); // IndexNow 单次上限

  const payload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/indexnow-key.txt`,
    urlList: urls,
  };

  const attempts = [];
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const text = await r.text().catch(() => '');
      attempts.push({ endpoint, status: r.status, body: text.slice(0, 200) });
      // 200 = 提交成功；202 = 已接受（key 校验异步完成）。
      // 422/403 = URL 不属于该 host / key 文件不对 → 换端点也没用，直接上报。
      if (r.status === 200 || r.status === 202) {
        console.log(`[indexnow] mode=${mode} urls=${urls.length} ok=${endpoint} ${r.status}`);
        return res.status(200).json({
          ok: true,
          mode,
          count: urls.length,
          urls,
          skipped,
          endpoint,
          indexnowStatus: r.status,
          attempts,
        });
      }
      console.warn(`[indexnow] ${endpoint} 返回 ${r.status}：${text.slice(0, 200)}`);
    } catch (err) {
      attempts.push({ endpoint, error: err?.message || String(err) });
      console.warn(`[indexnow] ${endpoint} 连不上：${err?.message || err}`);
    }
  }

  console.error('[indexnow] 全部端点都失败：', JSON.stringify(attempts));
  return res.status(502).json({ ok: false, error: 'PushFailed', urls, attempts });
}
