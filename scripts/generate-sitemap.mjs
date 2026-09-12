// 构建时脚本：从 Supabase 读取公开文章，生成 public/sitemap.xml（随 Vite 构建发布到 dist/）
// 说明：
//   - 阅读权限依赖 articles 表的 RLS（匿名可读，与前端 / generate-rss.mjs 一致）
//   - 站点域名：默认使用 https://www.the-set-of-murmurs.me，可用环境变量 SITE_URL 覆盖
//   - 路由形态自动识别：src/App.tsx 用的是 HashRouter 就生成 /#/xxx，
//     换成 BrowserRouter 后自动变成 /xxx，无需改本脚本
//   - 只收录公开可访问的页面：/login、/write、/profile（需登录）一律不进站点地图
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

function makeUrl(path, lastmod) {
  return { loc: `${SITE_URL}${path}`, lastmod };
}

async function main() {
  const prefix = detectPrefix();
  const url = `${SUPABASE_URL}/rest/v1/articles?select=id,date,category&order=date.desc`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  if (!res.ok) throw new Error(`Supabase 返回 ${res.status}`);
  const rows = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  const page = (p) => (p === '/' ? `${prefix}/` : `${prefix}${p}`);

  const entries = [
    ...STATIC_ROUTES.map((p) => makeUrl(page(p), today)),
    // 分类页：只收录数据库里真实存在、且是已知分类的
    ...[...new Set(rows.map((r) => r && r.category).filter((c) => c && CATEGORY_LABEL[c]))].map((c) =>
      makeUrl(page(`/category/${c}`), today)
    ),
    // 文章详情页
    ...rows
      .filter((r) => r && r.id)
      .map((r) => makeUrl(page(`/article/${r.id}`), day(r.date))),
  ];

  const body = entries
    .map((e) => `  <url>\n    <loc>${esc(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  const out = join(ROOT, 'public', 'sitemap.xml');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, xml, 'utf-8');
  console.log(`[sitemap] 已生成 ${out}（${entries.length} 条 URL，路由前缀「${prefix || '/'}」）`);
  if (prefix) {
    console.warn('[sitemap] 检测到 HashRouter：# 之后的地址搜索引擎不收录，');
    console.warn('[sitemap] 因此这些 URL 目前实际只能体现首页；切换到 BrowserRouter 后本脚本会自动生成真实路径。');
  }
}

main().catch((err) => {
  // 生成失败不阻断构建，只输出只含首页的空壳 sitemap
  console.warn('[sitemap] 生成失败（不影响构建）：', err && err.message ? err.message : err);
  const out = join(ROOT, 'public', 'sitemap.xml');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_URL}/</loc>\n  </url>\n</urlset>\n`,
    'utf-8'
  );
});
