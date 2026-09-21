#!/usr/bin/env node
/**
 * ============================================================================
 * 英文版 HTML 壳（路线 B，P1，2026-09-21）
 * ----------------------------------------------------------------------------
 * 为什么需要它：站点是**客户端渲染的 SPA**，dist/index.html 只是个空壳，
 * 而壳里的语言信息（lang / title / description / 首屏 preload 哪套字体 /
 * 加载过场文案）是**静态写在 HTML 里**的，运行时 JS 改不了"还没跑 JS 之前"
 * 的那一屏，也改不了爬虫看到的那份 HTML。
 *
 * 所以构建后额外产出一份 dist/en/index.html：
 *   · <html lang="en">                    → 浏览器选字形/断词、爬虫判语言
 *   · title / description 换英文           → 分享卡片与搜索结果
 *   · 去掉 3 条中文字体 preload + 中文 CSS → **英文页首屏不再拉 1.5MB 中文分片**
 *   · 改成拉丁字体 CSS + preload 一条       → 首屏只拉 49.6KB 的拉丁正体
 *   · 过场 splash 文案换英文               → 中文站那屏"呓语集 / 加载中…"不露在英文页
 *   · hreflang 互指                        → 中英两版被当成同一内容的两种语言
 *
 * ★ 这个脚本**只改 dist，不改 src**，而且每一处替换都断言命中：
 *   以后 index.html 结构变了（比如字体链接换行、splash 改文案），
 *   这里会直接报错并列出没命中的那一条，而不是悄悄产出一个半中半英的壳。
 * ============================================================================
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'dist', 'index.html');
const OUT_DIR = join(ROOT, 'dist', 'en');
const OUT = join(OUT_DIR, 'index.html');

const SITE = 'https://www.the-set-of-murmurs.me';

if (!existsSync(SRC)) {
  console.error('[en-shell] 没找到 dist/index.html —— 请先跑 vite build');
  process.exit(1);
}

let html = readFileSync(SRC, 'utf8');

/** 每一处替换都必须命中，否则报错退出（防止 index.html 改了形还悄悄产出半中半英的壳） */
const missed = [];
function swap(label, from, to, { optional = false } = {}) {
  if (!html.includes(from)) {
    if (!optional) missed.push(label);
    return false;
  }
  html = html.replace(from, to);
  return true;
}

// ---- 1. 语言属性 ----
swap('<html lang> 改成 en', '<html lang="zh-CN">', '<html lang="en">');

// ---- 2. 标题与描述 ----
swap(
  'title 换英文',
  '<title>呓语集</title>',
  '<title>The Set of Murmurs</title>',
);
swap(
  'meta description 换英文',
  'content="呓语集 - 记录动漫、随想、读后感与数学学习的个人博客"',
  'content="The Set of Murmurs — a personal blog on anime, essays, reading notes and mathematics."',
);

// ---- 3. 字体：撤掉中文字体（preload × 3 + CSS），换拉丁字体 ----
const cjkPreloads = [
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/nstc-symbol1.woff2?v=4" crossorigin />',
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/nstc-common.woff2?v=4" crossorigin />',
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/nstc-fill1.woff2?v=4" crossorigin />',
];
for (const l of cjkPreloads) {
  const ok = swap('移除中文 preload', l + '\n    ', '', { optional: true });
  if (!ok) swap('移除中文 preload', l, '', { optional: true });
}
swap(
  '移除中文字体 CSS',
  '<link rel="stylesheet" href="/fonts/noto-serif-tc/noto-serif-tc.css?v=4" />',
  '<link rel="stylesheet" href="/fonts/source-serif-4/source-serif-4.css?v=1" />\n    <link rel="preload" as="font" type="font/woff2" href="/fonts/source-serif-4/source-serif-4-latin-wght-normal.woff2?v=1" crossorigin />',
);

// ---- 3b. 清掉描述中文字体的 HTML 注释（在英文壳里是无关的中文维护说明） ----
let droppedComments = 0;
html = html.replace(/<!--[\s\S]*?-->/g, (c) => {
  if (c.includes('noto-serif-tc')) {
    droppedComments++;
    return `<!-- 英文页字体：拉丁衬线 Source Serif 4（自托管，见 /fonts/source-serif-4/source-serif-4.css）
         为什么是它：中文线用的 Noto Serif TC/SC（思源宋体）的拉丁部分本来就是 Source Serif 的骨架，
         两边同源，中英混排不会有两套字感。首选 preload 只有一条 49.6KB 的拉丁正体。 -->`;
  }
  return c;
});

// ---- 4. 过场 splash：文案与字体 ----
swap('splash 字体', "'Noto Serif TC','Noto Serif SC'", "'Source Serif 4',Georgia");
swap('splash 站名', '<div class="logo">呓语集</div>', '<div class="logo">Murmurs</div>');
swap('splash 加载中', '<div class="tip">加载中…</div>', '<div class="tip">Loading…</div>');
swap('splash 超时提示', '加载失败或网络较慢', 'Loading failed or the network is slow');
swap('splash 重载按钮', '>重新加载<', '>Reload<');

// ---- 5. hreflang 互指（中英是同一内容的两种语言） ----
swap(
  'hreflang 注入',
  '<link rel="icon"',
  `<link rel="alternate" hreflang="en" href="${SITE}/en/" />
    <link rel="alternate" hreflang="zh-CN" href="${SITE}/" />
    <link rel="alternate" hreflang="x-default" href="${SITE}/" />
    <link rel="icon"`,
);

if (missed.length) {
  console.error('[en-shell] 以下替换没命中，index.html 的结构可能变了：');
  for (const m of missed) console.error('  · ' + m);
  process.exit(1);
}

// ---- 6. 自检：产物里不该再有中文字体引用 ----
const leftovers = html.match(/noto-serif-tc/g) || [];
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log('[en-shell] 已产出 dist/en/index.html');
console.log('  · 大小        ', kb(Buffer.byteLength(html)));
console.log('  · <html lang> ', (html.match(/<html lang="([^"]+)"/) || [])[1]);
console.log('  · 标题        ', (html.match(/<title>([^<]*)<\/title>/) || [])[1]);
console.log('  · 清掉的中文字体注释', droppedComments, '处');
console.log('  · 残留 noto-serif-tc 引用次数', leftovers.length, leftovers.length ? '（应为 0！）' : '');
if (leftovers.length) process.exit(1);
