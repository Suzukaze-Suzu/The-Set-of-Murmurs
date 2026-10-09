// 构建期预渲染
//   2026-09-29 第 5 批：先给文章详情页产出带正文的静态 HTML。
//   2026-09-30 seo-h1 轮：扩到「所有公开路由」——每页都带**恰好一个 <h1>** + 该页专属
//   title/description + 站内链接（首页/文章页/分类页顺带把文章 URL 链出去，爬虫不必只靠 sitemap）。
//
// ★ 2026-10-09「英文站不依附中文站，先加载英文翻译，然后没上线的话再变为中文」★
//   改前：/en/ 的静态 HTML 全是中文——因为这里读的是 `article.title_en` / `summary_en`，
//         而库里根本没有这两列，于是永远回退中文（等于英文站的 SEO 内容依附中文站）。
//   现在：英文页（详情页＋列表页）**以已审校（reviewed）的英文译文为第一来源**，
//         正文按段落对齐合并（复用 src/lib/segments.ts 那份纯函数，没译的段显示中文原文）；
//         某篇没有已上线译文 → 那一篇逐字段回退中文原文（A 口径，不加标记）。
//         注入给前端的 `window.__PRERENDERED_ARTICLE__` **仍是中文原稿**（前端要拿它做段落对齐）。
//   中文页产出一个字都没动。
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
// ★ 2026-10-09「英文站不依附中文站」：段落对齐**直接用真前端那份纯函数**（Node 24 原生吃 .ts），
//   不在这里复制第二份实现——脚本与前端一旦漂移，英文页的正文就会和站内渲染不一致。
import { splitSegments, alignSegments, mergeContent } from '../src/lib/segments.ts';

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

// 本页在「正身域名」下的规范地址。
// 2026-10-02：Bing 搜出来的是 the-set-of-murmurs.vercel.app——因为 Vercel 给每个项目
// 的永久别名 `the-set-of-murmurs.vercel.app` 是公开可访问的镜像主机，而页面里**没有任何
// canonical 声明正身**（sitemap/rss/robots/hreflang 只是「推荐抓这个」，不是「这份内容的
// 正身是那个」）。同一内容挂在两个主机又无指向信号时，搜索引擎就按自己先认识的挑。
// 所以：每个预渲染页都要自报正身；镜像主机（含 Vercel 的部署地址）上的页面也照报，等于
// 从内容层把 vercel.app 那批 URL 收敛回 www。Vercel 侧另有 301 兜底，见 first/seo-domain-canonical/。
function canonicalUrl(path, locale) {
  const suffix = path || '/';
  return `${SITE_URL}${locale === 'en' ? '/en' : ''}${suffix}`;
}

function setCanonical(html, path, locale) {
  const url = canonicalUrl(path, locale);
  // 先清旧值再插，保证「同一份产物重复构建」幂等（模板里本来就带 canonical 也不会叠加）
  const stripped = html.replace(/[ \t]*<link rel="canonical"[^>]*>[ \t]*\r?\n?/g, '');
  if (!/<\/title>/.test(stripped)) throw new Error('模板里找不到 </title>，插不了 canonical');
  return stripped.replace(/<\/title>/, `</title>\n    <link rel="canonical" href="${url}" />`);
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
  html = setCanonical(html, path, locale);
  html = setHreflang(html, path);
  return injectIntoRoot(html, inner);
}

// ---------------------------------------------------------------------------
// 文章数据
// ---------------------------------------------------------------------------
/**
 * 取 Supabase REST。**带 3 次重试**（2026-10-09 补）：国内直连 Supabase 经常被 SNI 重置，
 * 以前一次失败就整批跳过预渲染 → dist 变成 SPA-only（爬虫只拿到空壳）。重试成本极低、收益很大。
 */
async function rest(path, label) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, { headers: H });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw new Error(`${label || path} 抓取失败（3 次）：${lastErr && lastErr.message}`);
}

async function fetchArticles() {
  return await rest('articles?select=*&order=date.desc', 'articles');
}

/**
 * ★ 2026-10-09「英文站不依附中文站，先加载英文翻译，然后没上线的话再变为中文」★
 * 已上线（reviewed）的英文译文 ＝ **英文页的第一来源**；某篇没有就逐字段回退中文原文。
 * 读不到就整体退回「全中文」（构建照常），绝不因为翻译表把整站产物搞挂。
 */
async function fetchReviewedTranslations() {
  const byId = new Map();
  try {
    const rows = await rest(
      'article_translations?select=article_id,title,summary,segments&locale=eq.en&status=eq.reviewed',
      'article_translations',
    );
    for (const r of rows) {
      byId.set(String(r.article_id), {
        title: String(r.title ?? ''),
        summary: String(r.summary ?? ''),
        segments: Array.isArray(r.segments) ? r.segments : null,
        chapters: new Map(),
      });
    }
  } catch (err) {
    console.warn(`[prerender] 英文译文读取失败，英文页整体回退中文：${err.message}`);
    return byId;
  }
  // 小说逐章译文（拿不到就逐章回退中文，不影响其它页）
  try {
    const chs = await rest(
      'article_translation_chapters?select=article_id,chapter_id,title,content,segments&locale=eq.en',
      'article_translation_chapters',
    );
    for (const c of chs) {
      const t = byId.get(String(c.article_id));
      if (t) t.chapters.set(String(c.chapter_id), c);
    }
  } catch (err) {
    console.warn(`[prerender] 小说逐章译文读取失败，章节回退中文：${err.message}`);
  }
  return byId;
}

/** 库里的 jsonb 段 → alignSegments 认的形状（与 src/lib/translations.ts 的 toTrSegments 同口径） */
function asTrSegments(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = [];
  raw.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const id = String(r.id ?? r.srcHash ?? '');
    if (!id) return;
    out.push({
      id,
      srcHash: String(r.srcHash ?? id),
      en: String(r.en ?? ''),
      i: typeof r.i === 'number' ? r.i : i,
    });
  });
  return out.length ? out : null;
}

/**
 * 用译文套中文原文，产出「英文页该显示的那一版」。
 * 规则与真前端 localizeArticle 一致：逐字段判断、缺什么回退什么（A 口径，不加标记）；
 * 正文按段落对齐合并（没译的段显示中文原文），小说逐章对齐。
 */
function localizeForEn(article, tr) {
  if (!tr) return article;
  const segs = asTrSegments(tr.segments);
  let content = article.content || '';
  if (segs) content = mergeContent(alignSegments(splitSegments(content), segs));

  let novel = article.novel;
  if (article.novel && Array.isArray(article.novel.chapters) && article.novel.chapters.length) {
    const chapters = article.novel.chapters.map((zh) => {
      const en = tr.chapters.get(String(zh.id));
      if (!en) return zh; // 这一章整章没译 → 用中文那一章
      const chSegs = asTrSegments(en.segments);
      let body = zh.content || '';
      if (chSegs) body = mergeContent(alignSegments(splitSegments(body), chSegs));
      else if (String(en.content || '').trim()) body = String(en.content);
      return {
        ...zh,
        title: String(en.title || '').trim() ? String(en.title) : zh.title,
        content: body,
      };
    });
    novel = {
      ...article.novel,
      synopsis: String(tr.summary || '').trim() ? tr.summary : article.novel.synopsis,
      chapters,
    };
  }

  return {
    ...article,
    title: String(tr.title || '').trim() ? tr.title : article.title,
    summary: String(tr.summary || '').trim() ? tr.summary : article.summary,
    content,
    novel,
  };
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
// 文章详情页 / 小说阅读界面
// 2026-10-09「把小说界面直接绑定到小说书架界面」：小说页出在 **/novels/<书id>**
// （canonical 也指那里），/article/<书id> 不再产出静态页——它由前端 replace 重定向过来，
// vercel.json 的 `/article/(.*)` rewrite 会兜住旧链接。判据与站内一致：reading 且有章节。
// ---------------------------------------------------------------------------
function isNovelArticle(article) {
  return article.category === 'reading' && !!(article.novel && article.novel.chapters && article.novel.chapters.length);
}

function renderArticlePage({ article, raw, contentHtml, template, locale, pagePath, chapters }) {
  /* ★ 2026-10-09：这里拆成两份数据（英文页必需）——
     · article = **这一页该显示的版本**（英文页＝已套译文的 localizeForEn 结果，缺译文就回退中文）；
     · raw     = **注入给前端的中文原稿**（前端要拿它做段落对齐，注入英文版会串行）。
     改前这里读的是 `article.title_en` / `article.summary_en`——库里根本没有这两列，
     于是 /en/ 的静态 HTML 永远是中文（这就是「英文站依附中文站」最硬的一处）。 */
  const source = raw || article;
  const title = article.title;
  const summary = article.summary || '';
  const metaDesc = summary || `${title} - ${siteName(locale)}`;

  const dataJson = JSON.stringify(source).replace(/</g, '\\u003c');
  /* 小说页额外列出章节目录（各章 h2 + 正文），让 /novels/<书id> 单页就是完整可读版；
     章节数据在 novel.chapters 里，content 是各章拼接（写作页写入时就是这么存的）。 */
  const chaptersHtml = chapters && chapters.length
    ? chapters
        .map(
          (ch) =>
            `<section class="novel-chapter"><h2>${escapeHtml(ch.title || '')}</h2><div class="markdown-body">${mdToHtml(
              ch.content || '',
            )}</div></section>`,
        )
        .join('\n')
    : '';
  const inner = `
<div class="article-prerendered" data-article-id="${escapeHtml(source.id)}">
  <article class="article-content">
    <header class="article-header">
      <h1>${escapeHtml(title)}</h1>
      ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ''}
    </header>
    ${chaptersHtml || `<div class="markdown-body">${contentHtml}</div>`}
  </article>
</div>
<script>window.__PRERENDERED_ARTICLE__ = ${dataJson};</script>`;

  return buildPage({
    template,
    locale,
    path: pagePath || `/article/${source.id}`,
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
  // 传进来的 article 已经是「这一页该显示的版本」（英文页＝译文优先，见 main() 的 view()）
  const title = article.title;
  const date = article.date ? `<time datetime="${escapeHtml(article.date)}">${escapeHtml(article.date)}</time>` : '';
  const summary = article.summary ? `<p>${escapeHtml(article.summary)}</p>` : '';
  // 小说条目指向书架族的阅读界面（与站内 lib/novelPath.ts 同一口径）
  const href = isNovelArticle(article) ? `${base}/novels/${escapeHtml(article.id)}` : `${base}/article/${escapeHtml(article.id)}`;
  return `<li><a href="${href}">${escapeHtml(title)}</a> ${date}${summary}</li>`;
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
function selfCheck(file, label, expectedCanonical) {
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

  // canonical：正身声明（2026-10-02 加）。缺了或取值不对 = 这页在搜索引擎眼里没有正身，
  // 直接算构建失败，不许悄悄出产物。
  const canAll = html.match(/<link rel="canonical"[^>]*>/g) || [];
  const can = canAll.length ? (canAll[0].match(/href="([^"]*)"/) || [])[1] : null;
  if (canAll.length !== 1) selfCheckFailures.push(`${label}: canonical 数量 = ${canAll.length}（必须恰好 1 条）`);
  if (expectedCanonical && can !== expectedCanonical) {
    selfCheckFailures.push(`${label}: canonical 取值不对（实际 ${can ?? '无'}，期望 ${expectedCanonical}）`);
  }

  return { h1Count, bytes: Buffer.byteLength(html, 'utf8'), canonical: can };
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

  /* ★ 2026-10-09「英文站不依附中文站，先加载英文翻译，然后没上线的话再变为中文」★
     英文线（/en/*）的**第一来源＝已审校的英文译文**；某篇没有译文 → 那一篇逐字段回退中文原文。
     中文线的产出一个字都不受这里影响（view() 对 zh 原样返回）。 */
  const trMap = await fetchReviewedTranslations();
  const enById = new Map();
  for (const a of articles) {
    const tr = trMap.get(a.id);
    if (tr) enById.set(a.id, localizeForEn(a, tr));
  }
  const view = (article, locale) => (locale === 'en' ? enById.get(article.id) || article : article);
  console.log(
    `[prerender] 英文线：${enById.size}/${articles.length} 篇用审校译文（其余 ${articles.length - enById.size} 篇回退中文）`,
  );

  // 1) 详情页：文章 → /article/<id>；小说 → /novels/<书id>（书架族，canonical 也指这里）
  const articleStats = [];
  for (const article of articles) {
    const novel = isNovelArticle(article);
    for (const locale of ['zh', 'en']) {
      const shown = view(article, locale); // 这一页该显示的版本（英文页＝已套译文）
      const pagePath = novel ? `/novels/${article.id}` : `/article/${article.id}`;
      const page = renderArticlePage({
        article: shown,
        raw: article,
        contentHtml: mdToHtml(shown.content),
        chapters: novel ? shown.novel.chapters : undefined,
        template: templates[locale],
        locale,
        pagePath,
      });
      const dir = join(DIST, ...(locale === 'en' ? ['en'] : []), ...pagePath.split('/').filter(Boolean));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'index.html');
      writeFileSync(file, page);
      articleStats.push({ ...selfCheck(file, `${locale}${pagePath}`, canonicalUrl(pagePath, locale)), pagePath, novel });
    }
  }
  console.log(
    `[prerender] 详情页：${articleStats.length} 个（h1=1 的 ${articleStats.filter((s) => s.h1Count === 1).length} 个，h1>1 的 ${articleStats.filter((s) => s.h1Count > 1).length} 个；其中小说页 /novels/<id> ${articleStats.filter((s) => s.novel).length} 个）`,
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
      // 英文页的列表同样以译文为主源（标题/摘要/正文都走 view()，缺译文那篇回退中文）
      const rowsLocale = locale === 'en' ? articles.map((a) => view(a, 'en')) : articles;
      const list =
        route.list === 'novels'
          ? rowsLocale.filter((a) => a.novel)
          : route.list === 'category'
            ? rowsLocale.filter((a) => a.category === route.category)
            : route.list === 'latest'
              ? [...rowsLocale].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12)
              : rowsLocale;

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
      staticStats.push({
        ...selfCheck(file, `${locale}${route.path || '/'}`, canonicalUrl(route.path, locale)),
        path: route.path,
        locale,
      });
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
  const all = articleStats.concat(staticStats);
  const canCount = all.filter((s) => s.canonical).length;
  console.log(`[prerender] canonical 命中：${canCount}/${all.length} 个页面（全部指向 ${SITE_URL}）`);
  if (canCount !== all.length) selfCheckFailures.push(`canonical 覆盖不全：${canCount}/${all.length}`);
  if (dictWarnings.length) {
    console.warn(`[prerender] 以下词典键没从 dict.ts 读到，用了内置副本或键名：${[...new Set(dictWarnings)].join(', ')}`);
  }
  if (selfCheckFailures.length) {
    console.error('[prerender] 自检失败：\n  - ' + selfCheckFailures.join('\n  - '));
    process.exit(1);
  }
  console.log('[prerender] 自检通过（h1 / SPA 脚本 / 加载屏 / 预渲染块 / hreflang / canonical 全部命中）');
}

main().catch((err) => {
  console.error('[prerender] 失败：', err);
  process.exit(1);
});
