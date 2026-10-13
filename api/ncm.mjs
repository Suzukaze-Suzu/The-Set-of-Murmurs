// Vercel Serverless Function：网易云歌曲信息**同源代理**
// 部署位置：api/ 目录下的文件自动成为 /api/xxx 接口（Vercel Functions），与 api/indexnow.mjs 同机制。
//
// ══════════════════════════════════════════════════════════════════════════════
// 为什么需要它（2026-10-13 真浏览器实测的结论，别再删）
// ──────────────────────────────────────────────────────────────────────────────
// 自绘播放器 NcmPlayer 原本在**读者浏览器**里直接 fetch：
//     https://music.163.com/api/song/detail/?ids=[…]
// 实测（.tmp-ncm-check/browser-cors-probe.mjs，真 Chrome）：**必失败**，报
//     TypeError: Failed to fetch
// 根因：那个接口的响应里**完全没有 `Access-Control-Allow-Origin` 头**
//       （带 Origin 发也一样，curl 原始头已验）→ 浏览器跨源读响应被拦。
// 后果：可用歌与版权歌**一律** failed=true → 播放器整块不渲染；
//       编辑器里的版权预检 probeNetEase 也永远走 catch → 返回 'unknown' → 从不弹警告。
//       （当时 32 项探针全绿，是因为它们只验 DOM 形状与计算样式，**不跑真实网络**。）
//
// 解法＝把这件取数搬到**服务器**：服务器没有同源策略，由它去问网易云，
//       再把结果回给同源的 /api/ncm。前端从此只打自家地址，不再碰 music.163.com。
//
// 接口：GET /api/ncm?id=<纯数字歌曲ID>
// 返回（**裁小过**，绝不透传上游原文）：
//   查到且有音频直链 → { ok:true, id, song:{ name, artist, duration, url } }
//   查到但无音频直链（版权/VIP）→ { ok:true, id, song:{ …, url:'' } }
//   上游答「没这首歌/已下架」→ { ok:true, id, song:null }
//   参数不合法 → 400 { ok:false, reason:'bad_id' }
//   上游连不上/超时 → 502 { ok:false, reason:'upstream' }
// ══════════════════════════════════════════════════════════════════════════════

const SONG_DETAIL = 'https://music.163.com/api/song/detail/?ids=[';
const SONG_URL = 'https://music.163.com/api/song/enhance/player/url?ids=[';

// 上游各自 8s 超时：Vercel 函数有执行上限，不能让一个卡住的上游拖死整个请求
const UPSTREAM_TIMEOUT_MS = 8_000;

// 缓存 300s。**上限由音频直链的有效期反推**：
// 直链带签名与时间戳、`expi = 1200` 秒（20 分钟）失效（2026-10-13 实测），
// 缓太久会把过期直链发给读者 → 播放键点了没反应。300s 留足余量。
// 这一行同时是「甲」的主要代价（Vercel 函数调用量）的缓解手段：边缘缓存住就不打函数。
const CACHE_HEADER = 'public, s-maxage=300, stale-while-revalidate=600';

// 简易限流：同 IP 60 秒内最多 60 次。
// 比 indexnow（3 次）松得多 —— 这是**读者侧**接口，一篇文章打开就可能请求一次；
// 但仍要有个天花板，免得被人拿去当「任意网易云取数机」刷。
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.NCM_RATE_MAX || 60);
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

/** 带超时的 fetch → 解析 JSON；任何失败抛错，由调用方兜 */
async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // 伪装成正常来源的网页请求，降低被风控拦的概率
        Referer: 'https://music.163.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 音频直链是 `http://m801.music.126.net/…`，而本站是 https ——
 * 直接塞进 <audio src> 会被浏览器按**混合内容**拦掉（2026-10-13 实测）。
 * 实测把 scheme 换成 https 后 CDN 正常（HEAD 200 / Range 206 / ACAO:*），所以统一升级。
 */
function forceHttps(u) {
  return typeof u === 'string' && u.startsWith('http://') ? 'https://' + u.slice(7) : u || '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, reason: 'method' });
  }

  // —— 参数校验：只认纯数字 ID。这是**唯一的**输入，
  //    写成白名单而不是「拼 URL」是为了不让它变成任意网易云接口的转发器。
  const raw = req.query?.id ?? (() => {
    try { return new URL(req.url, 'http://x').searchParams.get('id'); } catch { return null; }
  })();
  const id = String(raw ?? '').trim();
  if (!/^\d{1,20}$/.test(id)) {
    return res.status(400).json({ ok: false, reason: 'bad_id' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();
  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, reason: 'rate_limited' });
  }

  const ids = encodeURIComponent(id);

  // 两个上游**并行**：曲目信息决定渲不渲染，音频直链只决定播放键能不能点。
  // 任一失败都不算整体失败（版权歌本就没有直链），所以用 allSettled。
  const [detailR, urlR] = await Promise.allSettled([
    fetchJson(`${SONG_DETAIL}${ids}]`),
    fetchJson(`${SONG_URL}${ids}]&br=128000`),
  ]);

  if (detailR.status !== 'fulfilled') {
    console.warn('[ncm] 曲目信息上游失败：', detailR.reason?.message || detailR.reason);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, reason: 'upstream' });
  }

  const s = detailR.value?.songs?.[0];
  // 上游明确答「没有这首歌」（{"songs":[]}）＝下架/查无此曲。
  // 这是**成功**的一种结果（不是错误），前端据此走「受限」分支。
  if (!s) {
    res.setHeader('Cache-Control', CACHE_HEADER);
    return res.status(200).json({ ok: true, id, song: null });
  }

  let url = '';
  if (urlR.status === 'fulfilled') {
    url = forceHttps(urlR.value?.data?.[0]?.url || '');
  } else {
    // 拿不到直链不算失败：版权/VIP 歌本就该没有，走禁用态即可
    console.warn('[ncm] 音频直链上游失败（按无直链处理）：', urlR.reason?.message || urlR.reason);
  }

  const song = {
    name: String(s.name || ''),
    artist: (Array.isArray(s.artists) ? s.artists : [])
      .map((a) => a?.name)
      .filter(Boolean)
      .join(' / '),
    duration: Number(s.duration || 0),
    url,
  };

  res.setHeader('Cache-Control', CACHE_HEADER);
  console.log(`[ncm] id=${id} name=${song.name || '(无)'} url=${url ? 'yes' : 'no'}`);
  return res.status(200).json({ ok: true, id, song });
}
