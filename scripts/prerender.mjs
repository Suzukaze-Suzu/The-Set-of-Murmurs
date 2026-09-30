// 构建期预渲染（第 5 批，2026-09-29）
// 为文章详情页产出带正文的静态 HTML，让搜索引擎能看到内容。
// SPA 挂载后照常接管（hydrate）。Supabase 抓不到时退化为「跳过预渲染」，不阻断构建。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

// 读取模板（中文用 dist/index.html，英文用 dist/en/index.html）
function readTemplate(locale) {
  const isEn = locale === 'en';
  const templatePath = isEn ? join(DIST, 'en', 'index.html') : join(DIST, 'index.html');
  if (!existsSync(templatePath)) {
    // 英文壳还没生成时回退到中文模板
    return readFileSync(join(DIST, 'index.html'), 'utf8');
  }
  return readFileSync(templatePath, 'utf8');
}

// 将 Markdown 转为 HTML 字符串（与前端 MarkdownRenderer 同管线）
function mdToHtml(md) {
  const el = React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [[rehypeKatex, KATEX_OPTS], rehypeRaw],
  }, md || '');
  return renderToString(el);
}

// 从 Supabase 拉文章列表
async function fetchArticles() {
  const res = await fetch(`${API}/articles?select=*&order=date.desc`, { headers: H });
  if (!res.ok) throw new Error(`articles fetch failed: ${res.status}`);
  return await res.json();
}

// 生成文章详情页的 HTML
function renderArticlePage({ article, contentHtml, locale }) {
  const isEn = locale === 'en';
  const title = isEn && article.title_en ? article.title_en : article.title;
  const summary = isEn && article.summary_en ? article.summary_en : (article.summary || '');
  const metaDesc = summary || `${article.title} - ${isEn ? 'The Set of Murmurs' : '呓语集'}`;

  // 读取对应语言的模板
  const template = readTemplate(locale);
  let html = template;

  // 替换标题
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)} - ${isEn ? 'The Set of Murmurs' : '呓语集'}</title>`);
  // 替换 meta description
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(metaDesc)}" />`);

  // 在 #root 中注入文章内容 + 数据脚本
  const articleDataJson = JSON.stringify(article).replace(/</g, '\\u003c');
  const injected = `
<div class="article-prerendered" data-article-id="${article.id}">
  <article class="article-content">
    <header class="article-header">
      <h1>${escapeHtml(title)}</h1>
      ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ''}
    </header>
    <div class="markdown-body">${contentHtml}</div>
  </article>
</div>
<script>window.__PRERENDERED_ARTICLE__ = ${articleDataJson};</script>
`;
  html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*<script>/, `<div id="root">${injected}</div>\n    <script>`);

  return html;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  console.log('[prerender] 开始预渲染文章详情页...');

  let articles;
  try {
    articles = await fetchArticles();
    console.log(`[prerender] 从 Supabase 拉到 ${articles.length} 篇文章`);
  } catch (err) {
    console.warn(`[prerender] Supabase 抓取失败，跳过预渲染：${err.message}`);
    return;
  }

  let count = 0;
  for (const row of articles) {
    const article = {
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

    // 中文页
    const zhHtml = mdToHtml(article.content);
    const zhPage = renderArticlePage({ article, contentHtml: zhHtml, locale: 'zh' });
    const zhDir = join(DIST, 'article', article.id);
    mkdirSync(zhDir, { recursive: true });
    writeFileSync(join(zhDir, 'index.html'), zhPage);
    count++;

    // 英文页
    const enArticle = { ...article };
    const enHtml = mdToHtml(enArticle.content);
    const enPage = renderArticlePage({ article: enArticle, contentHtml: enHtml, locale: 'en' });
    const enDir = join(DIST, 'en', 'article', article.id);
    mkdirSync(enDir, { recursive: true });
    writeFileSync(join(enDir, 'index.html'), enPage);
    count++;
  }

  console.log(`[prerender] 完成，共生成 ${count} 个静态页`);
}

main().catch((err) => {
  console.error('[prerender] 失败：', err);
  process.exit(1);
});
