// 构建期预渲染
//   2026-09-29 第 5 批：先给文章详情页产出带正文的静态 HTML。
//   2026-09-30 seo-h1 轮：扩到「所有公开路由」——每页都带**恰好一个 <h1>** + 该页专属
//   title/description + 站内链接（首页/文章页/分类页顺带把文章 URL 链出去，爬虫不必只靠 sitemap）。
//
// 为什么必须做：全站是 CSR，除文章页外爬虫拿到的 HTML 是一具空壳（无 h1、无标题、无内链）。
//
// 实现要点：
//   - 中文首页模板被 prerender 改写后，英文壳是从改写过的那份派生的 → 本脚本必须在
//     generate-en-shell.mjs 之后跑（package.json build 链已是这个顺序）。
//   - SPA 挂载后照常接管（createRoot 会清空 #root）；#splash 加载屏保留在预渲染内容之后，
//     慢网下用户看到的仍是加载屏，爬虫读到的是真内容。
//   - 模板在 main() 开头一次性读进内存（中文/英文各一份干净壳），之后所有页面都从内存的干净壳
//     生成，绝不二次读盘 → 避免「首页已经被改写后又被当作后续页面的模板」这类内容串扰。
//   - Supabase 抓不到时退化为「跳过预渲染」，不阻断构建。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';
const SITE_URL = (process.env.SITE_URL || 'https://www.the-set-of-murmurs.me').replace(/\/+$/, '');
const API = `${SUPABASE_URL}/rest/v1`;
const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' };

const KATEX_OPTS = { throwOnError: false, strict: false };

// ---------------------------------------------------------------------------
// 文案：一律从 src/i18n/dict.ts 现读，不硬编码（读不到才退回下面的副本并告警）
// ---------------------------------------------------------------------------
const DICT_FALLBACK = {
  'brand.full': { zh: '呓语集', en: 'The Set of Murmurs' },
  'brand.tagline': { zh: '未知的梦话与胡言乱语', en: 'Dreams half-known, words unaccounted for' },
  'brand.description': {
    zh: '呓语集 - 记录动漫、随想、读后感与数学学习的个人博客',
    en: 'The Set of Murmurs — a personal blog on anime, essays, reading notes and mathematics.',
  },
  'brand.intro': {
    zh: '这里是呓语集，会记录一些不自知的情绪和严谨的呓语。',
    en: 'This is The Set of Murmurs — a place for unfelt feelings and grave murmurs.',
  },
  'nav.home': { zh: '首页', en: 'Home' },
  'nav.articles': { zh: '文章', en: 'Articles' },
  'nav.bookshelf': { zh: '书架', en: 'Bookshelf' },
  'nav.gallery': { zh: '图集', en: 'Gallery' },
  'nav.guestbook': { zh: '留言', en: 'Guestbook' },
  'nav.friends': { zh: '友链', en: 'Friends' },
  'nav.about': { zh: '关于', en: 'About' },
  'home.latestUpdates': { zh: '最新更新', en: 'Latest Updates' },
  'article.all': { zh: '全部文章', en: 'All Articles' },
  'shelf.title': { zh: '小说书架', en: 'Bookshelf' },
  'gallery.heading': { zh: '我喜欢的图片', en: 'Pictures I Like' },
  'friends.heading': { zh: '友情链接', en: 'Friends & Links' },
  'comment.guestbookTitle': { zh: '留言板', en: 'Guestbook' },
  'about.heading': { zh: '关于本站', en: 'About' },
};

function unescapeJs(s) {
  return s.replace(/\\(['"\\])/g, '$1');
}

function readDictEntry(src, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `'${escapedKey}'\\s*:\\s*\\{\\s*zh:\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*,\\s*en:\\s*'((?:[^'\\\\]|\\\\.)*)'`,
  );
  const m = re.exec(src);
  if (!m) return null;
  return { zh: unescapeJs(m[1]), en: unescapeJs(m[2]) };
}

let dictSource = '';
try {
  dictSource = readFileSync(join(ROOT, 'src', 'i18n', 'dict.ts'), 'utf8');
} catch (err) {
  console.warn(`[prerender] 读不到 src/i18n/dict.ts（${err.message}），改用脚本内置副本`);
}

const dictWarnings = [];
function t(key, locale) {
  const isEn = locale === 'en';
  const live = dictSource ? readDictEntry(dictSource, key) : null;
  if (live) return live[isEn ? 'en' : 'zh'];
  const fb = DICT_FALLBACK[key];
  if (fb) {
    dictWarnings.push(key);
    return fb[isEn ? 'en' : 'zh'];
  }
  dictWarnings.push(key);
  return key;
}

// ---------------------------------------------------------------------------
// 模板改写
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 把内容塞进 #root，**只保留原模板里的 #splash 加载屏**（放在预渲染内容之后，视觉上盖住它）。
// 传入的 template 必须是干净的原始壳（#root 里只有 splash），这样保留出来的才是纯 splash。
function injectIntoRoot(template, inner) {
  const open = '<div id="root">';
  const openAt = template.indexOf(open);
  if (openAt < 0) throw new Error('模板里找不到 <div id="root">');
  const afterOpen = openAt + open.length;
  const nextScript = template.indexOf('<script', afterOpen);
  const closeAt = template.lastIndexOf('</div>', nextScript < 0 ? template.length : nextScript);
  if (closeAt < afterOpen) throw new Error('找不到 #root 的闭合 </div>');
  const splash = template.slice(afterOpen, closeAt).trim(); // 干净壳里就只有 #splash
  return (
    template.slice(0, afterOpen) +
    '\n      ' +
    inner +
    (splash ? '\n      ' + splash : '') +
    '\n    ' +
    template.slice(closeAt)
  );
}

function setTitle(html, title) {
  if (!/<title>[\s\S]*?<\/title>/.test(html)) throw new Error('模板里找不到 <title>');
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

function setDescription(html, desc) {
  if (!/<meta name="description"[^>]*>/.test(html)) throw new Error('模板里找不到 meta description');
  return html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(desc)}" />`);
}

function setHreflang(html, path) {
  const suffix = path || '/';
  const zhUrl = `${SITE_URL}${suffix}`;
  const enUrl = `${SITE_URL}/en${suffix}`;
  const block = [
    `<link rel="alternate" hreflang="zh-Hans" href="${zhUrl}" />`,
    `<link rel="alternate" hreflang="en" href="${enUrl}" />`,
    `<link rel="alternate" hreflang="x-default" href="${zhUrl}" />`,
  ].join('\n    ');
  const stripped = html.replace(/[ \t]*<link rel="alternate"[^>]*>[ \t]*\r?\n?/g, '');
  if (!/<\/title>/.test(stripped)) throw new Error('模板里找不到 </title>，插不了 hreflang');
  return stripped.replace(/<\/title>/, `</title>\n    ${block}`);
}

function buildPage({ template, locale, path, title, description, inner }) {
  let html = template;
  html = setTitle(html, title);
  html = setDescription(html, description);
  html = setHreflang(html, path);
  return injectIntoRoot(html, inner);
}

// ---------------------------------------------------------------------------
// 文章数据
// ---------------------------------------------------------------------------
async function fetchArticles() {
  const res = await fetch(`${API}/articles?select=*&order=date.desc`, { headers: H });
  if (!res.ok) throw new Error(`articles fetch failed: ${res.status}`);
  return await res.json();
}

function mdToHtml(md) {
  const el = React.createElement(
    ReactMarkdown,
    { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [[rehypeKatex, KATEX_OPTS], rehypeRaw] },
    md || '',
  );
  return renderToString(el);
}

function normalizeArticle(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content || '',
    category: row.category || 'essay',
    tags: row.tags || [],
    date: row.date,
    favorite: !!row.favorite,
    pinned: !!row.pinned,
    summary: row.summary || '',
    novel: row.novel ? (typeof row.novel === 'string' ? JSON.parse(row.novel) : row.novel) : undefined,
  };
}

function siteName(locale) {
  return t('brand.full', locale);
}

// ---------------------------------------------------------------------------
// 文章详情页
// ---------------------------------------------------------------------------
function renderArticlePage({ article, contentHtml, template, locale }) {
  const isEn = locale === 'en';
  const title = isEn && article.title_en ? article.title_en : article.title;
  const summary = isEn && article.summary_en ? article.summary_en : article.summary || '';
  const metaDesc = summary || `${title} - ${siteName(locale)}`;

  const dataJson = JSON.stringify(article).replace(/</g, '\\u003c');
  const inner = `
<div class="article-prerendered" data-article-id="${escapeHtml(article.id)}">
  <article class="article-content">
    <header class="article-header">
      <h1>${escapeHtml(title)}</h1>
      ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ''}
    </header>
    <div class="markdown-body">${contentHtml}</div>
  </article>
</div>
<script>window.__PRERENDERED_ARTICLE__ = ${dataJson};</script>`;

  return buildPage({
    template,
    locale,
    path: `/article/${article.id}`,
    title: `${title} - ${siteName(locale)}`,
    description: metaDesc,
    inner,
  });
}

// ---------------------------------------------------------------------------
// 静态路由页（首页 / 文章 / 书架 / 图集 / 关于 / 友链 / 留言 + 分类页）
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { key: 'nav.home', path: '' },
  { key: 'nav.articles', path: '/articles' },
  { key: 'nav.bookshelf', path: '/novels' },
  { key: 'nav.gallery', path: '/gallery' },
  { key: 'nav.guestbook', path: '/guestbook' },
  { key: 'nav.friends', path: '/friends' },
  { key: 'nav.about', path: '/about' },
];

const STATIC_ROUTES = [
  { path: '', h1Key: 'brand.full', paraKey: 'brand.tagline', list: 'latest', descKey: 'brand.description' },
  { path: '/articles', h1Key: 'article.all', list: 'all' },
  { path: '/novels', h1Key: 'shelf.title', list: 'novels' },
  { path: '/gallery', h1Key: 'gallery.heading' },
  { path: '/about', h1Key: 'about.heading', paraKey: 'brand.intro' },
  { path: '/friends', h1Key: 'friends.heading' },
  { path: '/guestbook', h1Key: 'comment.guestbookTitle' },
];

function articleListItem(article, locale, base) {
  const title = locale === 'en' && article.title_en ? article.title_en : article.title;
  const date = article.date ? `<time datetime="${escapeHtml(article.date)}">${escapeHtml(article.date)}</time>` : '';
  const summary = article.summary ? `<p>${escapeHtml(article.summary)}</p>` : '';
  return `<li><a href="${base}/article/${escapeHtml(article.id)}">${escapeHtml(title)}</a> ${date}${summary}</li>`;
}

function staticInner({ route, locale, articles }) {
  const isEn = locale === 'en';
  const base = isEn ? '/en' : '';
  const name = siteName(locale);
  const h1 = t(route.h1Key, locale);

  const paras = [];
  if (route.paraKey) paras.push(`<p>${escapeHtml(t(route.paraKey, locale))}</p>`);
  if (route.list) {
    const note = isEn ? `${articles.length} in total.` : `共 ${articles.length} 篇。`;
    paras.push(`<p>${escapeHtml(note)}</p>`);
  }

  const nav = `<nav class="prerendered-nav"><ul>${NAV_ITEMS.map(
    (item) => `<li><a href="${base}${item.path || '/'}">${escapeHtml(t(item.key, locale))}</a></li>`,
  ).join('')}</ul></nav>`;

  const sections = [];
  if (route.list) {
    let heading;
    if (route.list === 'latest') heading = t('home.latestUpdates', locale);
    else if (route.list === 'all') heading = t('article.all', locale);
    else if (route.list === 'novels') heading = t('shelf.title', locale);
    else heading = escapeHtml(t(`cat.${route.category ?? 'other'}`, locale));
    sections.push(
      `<section><h2>${escapeHtml(heading)}</h2><ul>${articles
        .map((a) => articleListItem(a, locale, base))
        .join('')}</ul></section>`,
    );
  }

  if (route.path === '') {
    const cats = [...new Set(articles.map((a) => a.category).filter(Boolean))];
    if (cats.length) {
      sections.push(
        `<section><h2>${escapeHtml(isEn ? 'Categories' : '分类')}</h2><ul>${cats
          .map(
            (c) => `<li><a href="${base}/category/${escapeHtml(c)}">${escapeHtml(t(`cat.${c}`, locale))}</a></li>`,
          )
          .join('')}</ul></section>`,
      );
    }
  }

  return `<div class="seo-prerendered" data-page="${escapeHtml(route.path || '/')}">
  <header>
    <h1>${escapeHtml(h1)}</h1>
    ${paras.join('\n    ')}
  </header>
  ${nav}
  ${sections.join('\n  ')}
</div>`;
}

function staticPageMeta({ route, locale, articles }) {
  const name = siteName(locale);
  const h1 = t(route.h1Key, locale);
  const isHome = route.path === '';
  const title = isHome ? decodeEntities(t('brand.description', locale)) : `${h1} - ${name}`;
  let description;
  if (route.descKey) description = decodeEntities(t(route.descKey, locale));
  else if (route.paraKey) description = decodeEntities(t(route.paraKey, locale));
  else description = `${name} · ${h1}${route.list ? `（共 ${articles.length} 篇）` : ''}`;
  return { title, description, h1 };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

// ---------------------------------------------------------------------------
// 自检
// ---------------------------------------------------------------------------
const selfCheckFailures = [];
function selfCheck(file, label) {
  const html = readFileSync(file, 'utf8');
  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count < 1) selfCheckFailures.push(`${label}: 没有 <h1>`);
  if (h1Count > 1) console.warn(`[prerender] 提示：${label} 有 ${h1Count} 个 <h1>（正文自带 h1 的文章）`);
  if (!/<script type="module"[^>]*src="[^"]*assets\/[^"]+"/.test(html)) {
    selfCheckFailures.push(`${label}: SPA 的 module 脚本不见了`);
  }
  if (!html.includes('id="splash"')) selfCheckFailures.push(`${label}: 加载屏 #splash 不见了`);
  if (!/class="seo-prerendered"|class="article-prerendered"/.test(html)) {
    selfCheckFailures.push(`${label}: 没有找到预渲染内容块`);
  }
  if (!/<link rel="alternate" hreflang="en"[^>]*>/.test(html)) selfCheckFailures.push(`${label}: 缺 hreflang`);
  return { h1Count, bytes: Buffer.byteLength(html, 'utf8') };
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('[prerender] 开始预渲染…');

  // ★ 在读任何数据之前，先把干净的原始壳读进内存，所有页面都从它生成，绝不二次读盘。
  const cleanZh = readFileSync(join(DIST, 'index.html'), 'utf8');
  const cleanEn = readFileSync(join(DIST, 'en', 'index.html'), 'utf8');
  const templates = { zh: cleanZh, en: cleanEn };

  let rows;
  try {
    rows = await fetchArticles();
    console.log(`[prerender] 从 Supabase 拉到 ${rows.length} 篇文章`);
  } catch (err) {
    console.warn(`[prerender] Supabase 抓取失败，跳过预渲染：${err.message}`);
    return;
  }
  const articles = rows.map(normalizeArticle);

  // 1) 文章详情页
  const articleStats = [];
  for (const article of articles) {
    for (const locale of ['zh', 'en']) {
      const page = renderArticlePage({
        article,
        contentHtml: mdToHtml(article.content),
        template: templates[locale],
        locale,
      });
      const dir = join(DIST, ...(locale === 'en' ? ['en'] : []), 'article', article.id);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'index.html');
      writeFileSync(file, page);
      articleStats.push(selfCheck(file, `${locale}/article/${article.id}`));
    }
  }
  console.log(
    `[prerender] 文章详情页：${articleStats.length} 个（h1=1 的 ${articleStats.filter((s) => s.h1Count === 1).length} 个，h1>1 的 ${articleStats.filter((s) => s.h1Count > 1).length} 个）`,
  );

  // 2) 静态路由页 + 分类页
  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))];
  const routes = [
    ...STATIC_ROUTES,
    ...categories.map((c) => ({ path: `/category/${c}`, h1Key: `cat.${c}`, list: 'category', category: c })),
  ];

  const staticStats = [];
  for (const route of routes) {
    for (const locale of ['zh', 'en']) {
      const list =
        route.list === 'novels'
          ? articles.filter((a) => a.novel)
          : route.list === 'category'
            ? articles.filter((a) => a.category === route.category)
            : route.list === 'latest'
              ? [...articles].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12)
              : articles;

      const inner = staticInner({ route: { ...route, list: route.list }, locale, articles: list });
      const meta = staticPageMeta({ route, locale, articles: list });
      const page = buildPage({
        template: templates[locale],
        locale,
        path: route.path,
        title: meta.title,
        description: meta.description,
        inner,
      });
      const dir = join(DIST, ...(locale === 'en' ? ['en'] : []), ...(route.path ? route.path.split('/').filter(Boolean) : []));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'index.html');
      writeFileSync(file, page);
      staticStats.push({ ...selfCheck(file, `${locale}${route.path || '/'}`), path: route.path, locale });
    }
  }
  console.log(`[prerender] 静态路由页：${staticStats.length} 个（含 ${categories.length} 个分类页 ×2 语言）`);

  // 3) 汇总判据
  const total = articleStats.length + staticStats.length;
  console.log(`[prerender] 完成，共生成 ${total} 个静态页`);
  console.log(
    `[prerender] h1 计数：全部页面 h1 ≥ 1 = ${articleStats.concat(staticStats).every((s) => s.h1Count >= 1) ? '通过' : '失败'}`,
  );
  console.log(
    `[prerender] 静态页 h1 是否全部恰好为 1：${
      staticStats.every((s) => s.h1Count === 1) ? '通过' : '有页面 h1 ≠ 1'
    }`,
  );
  if (dictWarnings.length) {
    console.warn(`[prerender] 以下词典键没从 dict.ts 读到，用了内置副本或键名：${[...new Set(dictWarnings)].join(', ')}`);
  }
  if (selfCheckFailures.length) {
    console.error('[prerender] 自检失败：\n  - ' + selfCheckFailures.join('\n  - '));
    process.exit(1);
  }
  console.log('[prerender] 自检通过（h1 / SPA 脚本 / 加载屏 / 预渲染块 / hreflang 全部命中）');
}

main().catch((err) => {
  console.error('[prerender] 失败：', err);
  process.exit(1);
});
