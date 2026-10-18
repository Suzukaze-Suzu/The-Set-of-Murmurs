// Vercel Serverless Function：Supabase **同源代理**
// 部署位置：api/ 目录下的文件自动成为 /api/xxx 接口（Vercel Functions），与 api/ncm.mjs 同机制。
//
// ── 为什么需要它（2026-10-15 实测）────────────────────────────────────────────
// 前端所有实时内容都从浏览器**直连** https://ghzcvuemtoqejyciirks.supabase.co 取；
// 墙内这条腿被掐（本机 node 实测 ECONNRESET / 234ms），而「墙内 → Vercel」是通的
// （首页 200 / 366~502ms）。于是网页能打开、却只剩构建期预渲染快照 ——
// 用户原话「只有快照在，没有内容」。
// 解法：浏览器只连本站同源 /api/sb/*，由 Vercel 服务器去连 Supabase（走 /api/ncm 同一条已验证的路）。
//
// ── ★ 2026-10-18：「连快照都打不开了」的根因（务必先读）★ ─────────────────────
//   原先写成 `api/sb/[...path].mjs`（catch-all），**在 Vercel 上没被当作 catch-all**：
//   线上实测 `/api/sb/x`（一段）能命中本函数、`/api/sb/rest/v1/articles`（多段）直接吃
//   Vercel 平台的 404 `NOT_FOUND` —— 即它只注册了「一段」的动态路由。
//   结果：前端每一发请求（REST/auth/storage）全 404 → 首屏永远拿不到数据 →
//   8 秒后落到「加载失败或网络较慢」＝用户说的「连快照都打不开」。
//   修法：**别碰动态路由**。文件搬到顶层 `api/sb.mjs`（与 `api/ncm.mjs` 同层级，
//   线上已被证明可用），目标路径整体放进查询参数：
//       /api/sb?u=<encodeURIComponent('/rest/v1/articles?select=…')>
//   `u` 值整体百分号编码，`?` `&` `/` 都在编码里，不会被任何一层拆开。
//
// ── 接口 ─────────────────────────────────────────────────────────────────────
//   任意方法  /api/sb?u=<encodeURIComponent(supabase 路径 + 查询)>
//   返回：上游状态码与响应体**原样**回传
//     非法路径        → 404 { ok:false, reason:'bad_path' }（**不打上游**，防被当任意转发器）
//     上游连不上/超时 → 502 { ok:false, reason:'upstream' }
//   兼容分支：旧形态 `/api/sb/<path>?<query>` 仍能解析（万一将来 Vercel 路由行为又变），
//   但前端一律走 `?u=`，不要再依赖路径段。
//
// ── 三条纪律 ─────────────────────────────────────────────────────────────────
//   ① 目标主机**写死**，只认 /rest/v1/ /auth/v1/ /storage/v1/ 三个前缀；
//   ② **绝不附带 service role key** —— 上游要什么权限，由浏览器带来的 apikey / Authorization 决定；
//   ③ 带鉴权的响应（/rest/v1/ /auth/v1/）一律 `private, no-store`，**绝不能被边缘缓存**；
//      只有 /storage/v1/object/public/* 的 GET 才给公开缓存。
//
// ── ★ 2026-10-18「丁 · 把出口流量大头搬走」★ ─────────────────────────────────
//   免费额度超了 5 GB（402 exceed_egress_quota），治本的一条是：**同一个响应别让
//   Supabase 出第二遍**。原先只有 storage 图片有边缘缓存，REST 一律 no-store ——
//   于是「每次访问都把整个留言板 + 全站评论（含 base64 头像）重下一遍」。
//   现在分三档：
//     · /storage/v1/object/public/*  → s-maxage=86400（图，原样）
//     · **匿名** GET /rest/v1/*      → s-maxage=300 ＋ stale-while-revalidate=3600
//     · 其余（带鉴权 / 写操作 / auth）→ private, no-store（原样，绝不缓存）
//   ⚠️ 匿名读与登入读**必须用不同的缓存键**：前端会给自己带会话的请求加外层参数
//      `&_r=auth`（见 src/lib/supabase.ts）。否则博主可能读到别人的匿名缓存
//      （表现为「权限时有时无」）。这里再兜一道：请求头带 Authorization 的，永不缓存。

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://ghzcvuemtoqejyciirks.supabase.co'
).replace(/\/+$/, '');

/** 只放行这三个前缀。写法是"白名单"而不是"拼 URL"，免得变成任意转发器。 */
const ALLOWED_PREFIXES = ['/rest/v1/', '/auth/v1/', '/storage/v1/'];

/** 请求头白名单：supabase-js 真正会用到的那几个。cookie/host/connection 一律不透传。 */
const FORWARD_REQUEST_HEADERS = [
  'apikey',
  'authorization',
  'content-type',
  'accept',
  'content-profile',
  'accept-profile',
  'prefer',
  'range',
  'x-client-info',
  'x-upsert',
  'x-retry-count',
  'if-none-match',
  'if-modified-since',
];

/** 响应头白名单：**刻意不含** content-length / content-encoding，
 *  因为 fetch 已经把响应体解压了，转发这两个头会让浏览器二次解压或长度对不上。
 *  长度交给 Vercel 自己重新算。 */
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'location',
];

// 本地测试钩子：SB_UPSTREAM_TIMEOUT_MS 只在开发机设置，Vercel 上不存在 → 生产恒为 15s。
// 用途：探针能在一秒内跑通「上游超时 → 502」这条分支，不必真等 15 秒。
const UPSTREAM_TIMEOUT_MS = Number(process.env.SB_UPSTREAM_TIMEOUT_MS || 15_000);

// 简易限流：同 IP 60 秒内最多 600 次（比 /api/ncm 更松——一次页面加载会问好几个接口）
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.SB_PROXY_RATE_MAX || 600);
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

function safeDecode(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

/** 取原始 path + query。**保留原样的百分号编码**，直接拼给上游，避免二次编解码跑偏。 */
function rawTarget(req) {
  const url = String(req.url || '');
  const qi = url.indexOf('?');
  const rawQuery = qi >= 0 ? url.slice(qi + 1) : '';

  // ① 现行形态：/api/sb?u=<encodeURIComponent(目标路径+查询)>
  //    只解码**一层**：u 里剩下的百分号编码是 supabase 自己的，要原样转给上游。
  const m = /(?:^|&)u=([^&]*)/.exec(rawQuery);
  if (m) {
    const target = safeDecode(m[1]);
    const tq = target.indexOf('?');
    const path = tq < 0 ? target : target.slice(0, tq);
    const query = tq < 0 ? '' : target.slice(tq);
    return { path, query };
  }

  // ② 旧形态兜底：/api/sb/<supabase 路径>?<query>
  //    2026-10-18 前的前端写法（Vercel 上多段路径吃 404，已弃用，只留解析能力）。
  const rawPath = qi >= 0 ? url.slice(0, qi) : url;
  const prefix = '/api/sb';
  if (rawPath === prefix || rawPath.startsWith(prefix + '/')) {
    return { path: rawPath.slice(prefix.length) || '/', query: qi >= 0 ? url.slice(qi) : '' };
  }

  // ③ 兜底：Vercel 把 `/api/sb` 前缀剥掉（旧 catch-all 形态会给 req.query.path 段数组）
  const q = req.query || {};
  const segParam = q.path;
  const segs = Array.isArray(segParam) ? segParam : typeof segParam === 'string' && segParam ? segParam.split('/') : [];
  if (segs.length) {
    return { path: '/' + segs.join('/'), query: qi >= 0 ? url.slice(qi) : '' };
  }

  return { path: '/', query: '' };
}

/** 请求体透传：Vercel 给我们的可能是 Buffer / 字符串 / 已解析对象，三种都要认。 */
function bodyFor(method, body) {
  if (method === 'GET' || method === 'HEAD') return undefined;
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return body;
  return JSON.stringify(body);
}

/** 不依赖 Vercel 的 Express 糖（res.status().json()）——裸 node 下没有这两个方法，
 *  而这个 handler 要能在本机 harness 里被直接调用（端到端探针靠它）。 */
function fail(res, code, payload) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const { path, query } = rawTarget(req);
  const decoded = safeDecode(path);

  /**
   * 外层标记 `_r=auth`：前端在「这个浏览器有会话」时加上的缓存键分隔符。
   * 它**只活在 /api/sb 自己的查询串里**，`rawTarget()` 只取 `u=`，所以永远不会
   * 被转发到 Supabase 上游。
   */
  const outerQuery = (() => {
    const u = String(req.url || '');
    const qi = u.indexOf('?');
    return qi >= 0 ? u.slice(qi + 1) : '';
  })();
  const markedAuth = /(?:^|&)_r=auth(?:&|$)/.test(outerQuery);
  /**
   * ⚠️ supabase-js 在**匿名**请求上也会带 `Authorization: Bearer <apikey>`（它的惯例），
   * 所以「有 Authorization 头」不等于「有会话」。判据改成：Authorization 的值**不是**
   * 本次请求的 apikey ⇒ 那是真会话（可缓存绝无可能）。前端带会话时还会额外打 `_r=auth`。
   */
  const authz = String(req.headers?.authorization || req.headers?.Authorization || '');
  const apikeyHdr = String(req.headers?.apikey || req.headers?.Apikey || '');
  const hasAuthHeader = !!authz && !(apikeyHdr && authz === 'Bearer ' + apikeyHdr);

  const allowed = ALLOWED_PREFIXES.some((p) => decoded.startsWith(p));
  if (!allowed) {
    return fail(res, 404, { ok: false, reason: 'bad_path' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  if (rateLimited(ip)) {
    return fail(res, 429, { ok: false, reason: 'rate_limited' });
  }

  // 转发头：只挑白名单，且必须有值
  const headers = {};
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = req.headers[name];
    if (v !== undefined && v !== null && v !== '') headers[name] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  // 同源代理下浏览器不会带 Origin，但万一带了就别往下传（上游的 CORS 判断用不上）
  delete headers.origin;

  const target = SUPABASE_URL + path + query;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: bodyFor(req.method, req.body),
      redirect: 'manual',
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    console.error('[sb] 上游请求失败：', err?.message || err, target);
    return fail(res, 502, { ok: false, reason: 'upstream' });
  }

  try {
    res.statusCode = upstream.status;
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const v = upstream.headers.get(name);
      if (v) res.setHeader(name, v);
    }

    // 缓存策略（2026-10-18 丁）：
    //   ① 公开对象（图）→ 公开长缓存
    //   ② 匿名 GET /rest/v1/* → 公开短缓存（边缘 5 分钟 + 1 小时 SWR）
    //   ③ 其余（带鉴权 / 写 / auth）→ 绝不缓存
    const isGet = req.method === 'GET' || req.method === 'HEAD';
    const isPublicObject = isGet && decoded.startsWith('/storage/v1/object/public/') && upstream.ok;
    const isAnonRest =
      req.method === 'GET' &&
      !markedAuth &&
      !hasAuthHeader &&
      decoded.startsWith('/rest/v1/') &&
      upstream.status === 200;

    res.setHeader(
      'Cache-Control',
      isPublicObject
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
        : isAnonRest
          ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
          : 'private, no-store, max-age=0',
    );
    // 便于线上探针一眼看出走了哪一档（不影响缓存语义）
    res.setHeader('x-sb-cache', isPublicObject ? 'public-object' : isAnonRest ? 'anon-rest' : 'none');

    if (req.method === 'HEAD' || upstream.status === 204 || upstream.status === 304 || !upstream.body) {
      return res.end();
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.end(buf);
  } finally {
    clearTimeout(timer);
  }
}
