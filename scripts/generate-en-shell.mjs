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

// ---- 3. 字体：只撤中文 preload，中文字体 CSS **保留** ----
// 2026-09-22 用户第 3 条：「英文站的中文不要换字体，用中文站的就可以了」——
// 英文页难免要显示还没译的汉字，所以 noto-serif-tc.css 必须留着，汉字才会落到站点
// 自托管的那套思源宋上（而不是 iPhone 的 Songti SC / Windows 的 Noto Serif SC）。
// 代价可控：@font-face 只在真有字符命中 unicode-range 时才下载，英文页没有汉字就不拉，
// 首屏那 1.5MB 的中文分片依旧不会自动下载 —— 所以只撤 preload、不撤 CSS。
const cjkPreloads = [
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/nstc-symbol1.woff2?v=4" crossorigin />',
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/nstc-common.woff2?v=4" crossorigin />',
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/nstc-fill1.woff2?v=4" crossorigin />',
];
for (const l of cjkPreloads) {
  const ok = swap('移除中文 preload', l + '\n    ', '', { optional: true });
  if (!ok) swap('移除中文 preload', l, '', { optional: true });
}

// ---- 3b. 清掉描述中文字体的 HTML 注释（在英文壳里是无关的中文维护说明） ----
let droppedComments = 0;
html = html.replace(/<!--[\s\S]*?-->/g, (c) => {
  if (c.includes('noto-serif-tc')) {
    droppedComments++;
    return `<!-- 英文页字体：拉丁＝自托管 murmurs-latin（标题 Cormorant Garamond +8%、
         正文 Sorts Mill Goudy + 粗体 Baskervville），汉字＝中文线那套 Noto Serif TC 分片。
         两套都按 unicode-range 按需下载：英文页没有汉字时不会拉中文分片，
         只撤了中文的 preload（中文字体 CSS 必须留着，见 scripts/generate-en-shell.mjs 第 3 步）。 -->`;
  }
  return c;
});

// ---- 4. 过场 splash：文案与字体 ----
swap('splash 字体', "'Noto Serif TC','Noto Serif SC'", "'Murmurs Body','Murmurs Title'");
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

// ---- 6. 自检 ----
// ★ 2026-09-22 口径**反转**：以前是「英文页里 noto-serif-tc 必须为 0」，现在是
//   「中文字体 CSS 必须**在**（英文站的中文要落到自托管思源宋，用户第 3 条要求），
//     但中文 preload 必须**不在**（首屏那 1.5MB 分片不能预拉）」。
const cjkCssLinks = (
  html.match(/<link rel="stylesheet" href="\/fonts\/noto-serif-tc\/noto-serif-tc\.css\?v=\d+" \/>/g) || []
).length;
const cjkPreloadLeft = (
  html.match(/<link rel="preload" as="font"[^>]*href="\/fonts\/noto-serif-tc\//g) || []
).length;
const latinCssLinks = (
  html.match(/<link rel="stylesheet" href="\/fonts\/murmurs-latin\/murmurs-latin\.css\?v=\d+" \/>/g) || []
).length;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log('[en-shell] 已产出 dist/en/index.html');
console.log('  · 大小        ', kb(Buffer.byteLength(html)));
console.log('  · <html lang> ', (html.match(/<html lang="([^"]+)"/) || [])[1]);
console.log('  · 标题        ', (html.match(/<title>([^<]*)<\/title>/) || [])[1]);
console.log('  · 清掉的中文字体注释', droppedComments, '处');
console.log('  · 中文字体 CSS ', cjkCssLinks, '（应为 1：英文页的汉字要落到自托管思源宋）');
console.log('  · 中文 preload ', cjkPreloadLeft, '（应为 0：首屏不预拉中文分片）');
console.log('  · 拉丁字体 CSS ', latinCssLinks, '（应为 1）');
if (cjkCssLinks !== 1 || cjkPreloadLeft !== 0 || latinCssLinks !== 1) {
  console.error('[en-shell] 英文页的字体引用不符合预期，先看上面两行数字。');
  process.exit(1);
}
