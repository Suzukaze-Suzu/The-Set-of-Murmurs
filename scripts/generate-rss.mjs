// 构建时脚本：从 Supabase 读取公开文章，生成 public/rss.xml 与 public/en/rss.xml
// 说明：
//   - 阅读权限依赖 articles 表的 RLS（匿名可读，与前端一致）
//   - 站点域名：默认使用 https://www.the-set-of-murmurs.me/，可用环境变量 SITE_URL 覆盖
//   - 路由形态自动识别：src/App.tsx 用 <HashRouter> 时链接带 /#，换成 BrowserRouter 后自动变成真实路径
//   - 英文频道（2026-09-29 追加）：标题/摘要优先取「已上线」的英文译文，没有译文就沿用中文，
//     链接一律指到 /en/article/<id>（英文页对未翻译文章会显示中文原文 + 一行说明）
//   - ★ 抓取失败时**不覆盖已有的 xml**（2026-09-29 修）：以前会拿一个空壳盖掉上次生成好的文件，
//     而 Supabase 在国内经常连不上（直连会被重置），等于每次构建都可能把站点地图打回空壳。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';
const SITE_URL = (process.env.SITE_URL || 'https://www.the-set-of-murmurs.me').replace(/\/+$/, '');

const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

const APP_TSX = join(ROOT, 'src', 'App.tsx');
const ROUTE_PREFIX =
  existsSync(APP_TSX) && /<HashRouter[\s>]/.test(readFileSync(APP_TSX, 'utf-8')) ? '/#' : '';

const CATEGORY_LABEL = { anime: '读后感', essay: '随笔', reading: '小说', math: '数学笔记', study: '学习分享' };

const OUT_ZH = join(ROOT, 'public', 'rss.xml');
const OUT_EN = join(ROOT, 'public', 'en', 'rss.xml');

function esc(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function rfc822(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

/** 抓取失败时不覆盖已有文件，只保证「文件一定存在」，避免把上次生成好的 xml 打回空壳 */
function keepOrSeed(out, seed) {
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out)) {
    console.warn(`[rss] 抓取失败，保留已有的 ${out}（未覆盖）`);
    return false;
  }
  writeFileSync(out, seed, 'utf-8');
  console.warn(`[rss] 抓取失败且本地无文件，写入空壳 ${out}`);
  return false;
}

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!res.ok) throw new Error(`Supabase ${path} 返回 ${res.status}`);
  return res.json();
}

async function main() {
  const rows = await rest('articles?select=id,title,date,summary,category&order=date.desc');

  // 已上线的英文译文（拿不到就整个英文频道退回中文标题，不算失败）
  let trMap = {};
  try {
    const trs = await rest('article_translations?select=article_id,title,summary&locale=eq.en&status=eq.reviewed');
    (trs || []).forEach((t) => { if (t && t.article_id) trMap[t.article_id] = t; });
  } catch (e) {
    console.warn('[rss] 英文译文读取失败，英文频道退回中文标题：', e && e.message ? e.message : e);
  }

  const usable = rows.filter((r) => r && r.title && r.date);

  const itemZh = (r) => `    <item>
      <title>${esc(r.title)}</title>
      <link>${SITE_URL}${ROUTE_PREFIX}/article/${esc(r.id)}</link>
      <guid isPermaLink="false">${esc(r.id)}</guid>
      <pubDate>${rfc822(r.date)}</pubDate>
      <category>${esc(CATEGORY_LABEL[r.category] || r.category || '')}</category>
      <description><![CDATA[${String(r.summary || '').replace(/\]\]>/g, ']]&gt;')}]]></description>
    </item>`;

  const itemEn = (r) => {
    const t = trMap[r.id] || {};
    const title = t.title || r.title;
    const desc = t.summary || r.summary || '';
    return `    <item>
      <title>${esc(title)}</title>
      <link>${SITE_URL}/en/article/${esc(r.id)}</link>
      <guid isPermaLink="false">${esc(r.id)}</guid>
      <pubDate>${rfc822(r.date)}</pubDate>
      <category>${esc(CATEGORY_LABEL[r.category] || r.category || '')}</category>
      <description><![CDATA[${String(desc).replace(/\]\]>/g, ']]&gt;')}]]></description>
    </item>`;
  };

  const xmlZh = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>呓语集</title>
    <link>${SITE_URL}${ROUTE_PREFIX}/</link>
    <description>记录动漫、随想、读后感与数学学习的个人博客</description>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>zh-CN</language>
${usable.map(itemZh).join('\n')}
  </channel>
</rss>
`;

  const xmlEn = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Set of Murmurs</title>
    <link>${SITE_URL}/en/</link>
    <description>The Set of Murmurs — a personal blog on anime, essays, reading notes and mathematics.</description>
    <atom:link href="${SITE_URL}/en/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en</language>
${usable.map(itemEn).join('\n')}
  </channel>
</rss>
`;

  mkdirSync(dirname(OUT_ZH), { recursive: true });
  mkdirSync(dirname(OUT_EN), { recursive: true });
  writeFileSync(OUT_ZH, xmlZh, 'utf-8');
  writeFileSync(OUT_EN, xmlEn, 'utf-8');
  const translated = usable.filter((r) => trMap[r.id]).length;
  console.log(`[rss] 已生成 ${OUT_ZH}（${usable.length} 篇）与 ${OUT_EN}（${usable.length} 篇，其中 ${translated} 篇用了英文译文）`);
}

main().catch((err) => {
  // 生成失败不阻断构建，但**不覆盖**已有 xml
  console.warn('[rss] 生成失败（不影响构建）：', err && err.message ? err.message : err);
  const seedZh = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>呓语集</title><link>${SITE_URL}${ROUTE_PREFIX}/</link></channel></rss>\n`;
  const seedEn = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>The Set of Murmurs</title><link>${SITE_URL}/en/</link></channel></rss>\n`;
  keepOrSeed(OUT_ZH, seedZh);
  keepOrSeed(OUT_EN, seedEn);
});
