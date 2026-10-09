// 构建时脚本：从 Supabase 读取公开文章，生成 public/sitemap.xml 与 public/en/sitemap.xml
// 说明：
//   - 阅读权限依赖 articles 表的 RLS（匿名可读，与前端 / generate-rss.mjs 一致）
//   - 站点域名：默认使用 https://www.the-set-of-murmurs.me，可用环境变量 SITE_URL 覆盖
//   - 路由形态自动识别：src/App.tsx 用的是 HashRouter 就生成 /#/xxx，换成 BrowserRouter 后自动变成 /xxx
//   - 只收录公开可访问的页面：/login、/write、/profile（需登录）一律不进站点地图
//   - 英文站点地图（2026-09-29 追加）：public/en/sitemap.xml，与中文站点地图互为一组，
//     两边每条 URL 都带 xhtml:link 三向 hreflang（zh-Hans / en / x-default），告诉搜索引擎「这是同一页的两种语言」
//   - ★ 抓取失败时**不覆盖已有的 xml**（2026-09-29 修），理由同 generate-rss.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';
const SITE_URL = (process.env.SITE_URL || 'https://www.the-set-of-murmurs.me').replace(/\/+$/, '');

// 与 src/App.tsx 的路由、以及 src/pages/SectionPage.tsx 的分类取值一一对应
const STATIC_ROUTES = ['/', '/articles', '/novels', '/gallery', '/about', '/guestbook', '/friends'];
const CATEGORY_LABEL = { anime: '读后感', essay: '随笔', reading: '小说', math: '数学笔记', study: '学习分享' };

const OUT_ZH = join(ROOT, 'public', 'sitemap.xml');
const OUT_EN = join(ROOT, 'public', 'en', 'sitemap.xml');

function esc(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function day(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// HashRouter 下页面地址是 /#/xxx；BrowserRouter 下就是 /xxx
function detectPrefix() {
  const app = join(ROOT, 'src', 'App.tsx');
  const hash = existsSync(app) && /<HashRouter[\s>]/.test(readFileSync(app, 'utf-8'));
  return hash ? '/#' : '';
}

function keepOrSeed(out, seed) {
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out)) {
    console.warn(`[sitemap] 抓取失败，保留已有的 ${out}（未覆盖）`);
    return;
  }
  writeFileSync(out, seed, 'utf-8');
  console.warn(`[sitemap] 抓取失败且本地无文件，写入空壳 ${out}`);
}

async function main() {
  const prefix = detectPrefix();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id,date,category,novel&order=date.desc`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase 返回 ${res.status}`);
  const rows = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  // 中文页路径（含 HashRouter 前缀）／英文页路径（永远带 /en）
  const zhPage = (p) => `${SITE_URL}${prefix}${p === '/' ? '/' : p}`;
  const enPage = (p) => `${SITE_URL}/en${p === '/' ? '/' : p}`;

  const entries = [
    ...STATIC_ROUTES.map((p) => ({ zh: zhPage(p), en: enPage(p), lastmod: today })),
    // 分类页：只收录数据库里真实存在、且是已知分类的
    ...[...new Set(rows.map((r) => r && r.category).filter((c) => c && CATEGORY_LABEL[c]))].map((c) => ({
      zh: zhPage(`/category/${c}`),
      en: enPage(`/category/${c}`),
      lastmod: today,
    })),
    // 详情页：小说进书架族的 `/novels/<书id>`（2026-10-09「小说界面绑定到书架」，
    // 与站内 lib/novelPath.ts、scripts/prerender.mjs 同一判据），其余仍 /article/<id>
    ...rows
      .filter((r) => r && r.id)
      .map((r) => {
        let nv = r.novel;
        if (typeof nv === 'string') { try { nv = JSON.parse(nv); } catch { nv = null; } }
        const isNovel = r.category === 'reading' && Array.isArray(nv && nv.chapters) && nv.chapters.length > 0;
        const p = `/novels/${r.id}`;
        const q = `/article/${r.id}`;
        return { zh: zhPage(isNovel ? p : q), en: enPage(isNovel ? p : q), lastmod: day(r.date) };
      }),
  ];

  const block = (e, useEn) => `  <url>
    <loc>${esc(useEn ? e.en : e.zh)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="${esc(e.zh)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${esc(e.en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(e.zh)}"/>
  </url>`;

  const wrap = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;

  mkdirSync(dirname(OUT_ZH), { recursive: true });
  mkdirSync(dirname(OUT_EN), { recursive: true });
  writeFileSync(OUT_ZH, wrap(entries.map((e) => block(e, false)).join('\n')), 'utf-8');
  writeFileSync(OUT_EN, wrap(entries.map((e) => block(e, true)).join('\n')), 'utf-8');
  console.log(`[sitemap] 已生成 ${OUT_ZH} 与 ${OUT_EN}（各 ${entries.length} 条 URL，含三向 hreflang；路由前缀「${prefix || '/'}」）`);
  if (prefix) {
    console.warn('[sitemap] 检测到 HashRouter：# 之后的地址搜索引擎不收录，');
    console.warn('[sitemap] 因此这些 URL 目前实际只能体现首页；切换到 BrowserRouter 后本脚本会自动生成真实路径。');
  }
}

main().catch((err) => {
  // 生成失败不阻断构建，但**不覆盖**已有 xml
  console.warn('[sitemap] 生成失败（不影响构建）：', err && err.message ? err.message : err);
  const shell = (u) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${u}</loc>\n  </url>\n</urlset>\n`;
  keepOrSeed(OUT_ZH, shell(`${SITE_URL}/`));
  keepOrSeed(OUT_EN, shell(`${SITE_URL}/en/`));
});
