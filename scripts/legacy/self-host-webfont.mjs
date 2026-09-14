/**
 * 【已弃用，2026-09-13，保留仅供追溯】这一版是「直接搬 Google Fonts 的 unicode-range 分片」，
 * 实测不适合本站：Google 的分片不按字频聚合，首页正文只有 407 个不同汉字却要下 110 个分片 / 7.78MB。
 * 现行方案见 scripts/subset-noto-serif-tc.py（按字频自切 hot/mid/ext 三片，共 2.2MB，首屏只取命中的片）。
 *
 * 自托管思源宋体（Noto Serif TC = Source Han Serif TC，繁体字形版，含简体字集）
 *
 * 为什么这么做：站点原先只写 font-family:'Noto Serif SC'，靠访客本机装没装这个字体，
 * 别人（手机/未装字体的电脑）会掉回华文宋体/SimSun。这里把 Google Fonts 的
 * unicode-range 分片 woff2 全部搬到本地，浏览器只按页面实际用到的字去取分片，
 * 既保证所有访客看到同一套字形，又不依赖 fonts.googleapis.com / gstatic（国内可达）。
 *
 * 用法：node scripts/self-host-webfont.mjs
 * 产物：public/fonts/noto-serif-tc/*.woff2 + noto-serif-tc.css（+ OFL.txt 许可原文）
 * 重跑是幂等的：已存在且大小一致的分片会跳过。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'fonts', 'noto-serif-tc');

const FAMILY_CSS_NAME = 'Noto+Serif+TC';
const WEIGHTS = [400, 500, 600, 700, 800, 900];
const FILE_PREFIX = 'nstc'; // noto serif tc，文件名短一点
const PUBLIC_URL_BASE = '/fonts/noto-serif-tc';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const cssUrl = `https://fonts.googleapis.com/css2?family=${FAMILY_CSS_NAME}:wght@${WEIGHTS.join(
  ';',
)}&display=swap`;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

async function downloadTo(url, dest, retries = 3) {
  const size = fs.existsSync(dest) ? fs.statSync(dest).size : -1;
  if (size > 1000) return { skipped: true, size };
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // woff2 魔数校验，避免把错误页存成字体
      if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('not a woff2 payload');
      fs.writeFileSync(dest, buf);
      return { skipped: false, size: buf.length };
    } catch (e) {
      if (attempt === retries) throw new Error(`下载失败 ${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

const css = await fetchText(cssUrl);
const blocks = css.split('@font-face').slice(1);
if (blocks.length < 50) throw new Error(`Google Fonts 只返回了 ${blocks.length} 个 @font-face，疑似被挡`);

fs.mkdirSync(OUT_DIR, { recursive: true });

// 解析每个 @font-face：weight / unicode-range / 远端 url
const entries = [];
for (const raw of blocks) {
  const weight = (raw.match(/font-weight:\s*([0-9]+)\s*;/) || [])[1];
  const range = (raw.match(/unicode-range:\s*([^;]+);/) || [])[1];
  const src = (raw.match(/src:\s*url\(([^)]+)\)/) || [])[1];
  if (!weight || !range || !src) continue;
  entries.push({ weight, range: range.trim(), src });
}

// 同名分片按 (weight, url) 唯一
const jobs = [];
const seen = new Set();
for (const e of entries) {
  const key = `${e.weight}|${e.src}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const idx = e.src.match(/\.(\d+)\.woff2$/) ? e.src.match(/\.(\d+)\.woff2$/)[1] : String(jobs.length);
  // 注意：同一字重里 (idx) 会撞车（Google 有 4 处重复 idx 但 url 不同），所以文件名带上 url 的短哈希
  const tag = createHash('sha1').update(e.src).digest('hex').slice(0, 8);
  const file = `${FILE_PREFIX}-${e.weight}-${idx}-${tag}.woff2`;
  jobs.push({ ...e, file, dest: path.join(OUT_DIR, file) });
}

console.log(`@font-face 块 ${blocks.length} 个 → 唯一分片 ${jobs.length} 个，开始下载…`);

let done = 0;
let bytes = 0;
let skipped = 0;
const CONCURRENCY = 6;
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const r = await downloadTo(job.src, job.dest);
    if (r.skipped) skipped++;
    else bytes += r.size;
    done++;
    if (done % 50 === 0) console.log(`  … ${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const totalBytes = jobs.reduce((n, j) => n + fs.statSync(j.dest).size, 0);
console.log(
  `下载完成：${jobs.length} 个分片（新下载 ${jobs.length - skipped}，跳过 ${skipped}），磁盘合计 ${(
    totalBytes / 1048576
  ).toFixed(1)}MB，本次新增 ${(bytes / 1048576).toFixed(1)}MB`,
);

// 生成本地 CSS：只把 url() 换成本地路径，其它（font-display / unicode-range）原样保留
const header = `/* 自托管思源宋体 TC（Noto Serif TC / Source Han Serif TC，OFL 1.1）
 * 由 scripts/self-host-webfont.mjs 自动生成，勿手改；字体分片在同目录下。
 * 繁体字形（台湾教育部标准字形），字集完整覆盖简体字，浏览器按 unicode-range 按需取片。
 * 许可原文见同目录 OFL.txt。
 */
`;
const body = entries
  .map((e) => {
    const job = jobs.find((j) => j.src === e.src && j.weight === e.weight);
    return `@font-face {
  font-family: 'Noto Serif TC';
  font-style: normal;
  font-weight: ${e.weight};
  font-display: swap;
  src: url('${PUBLIC_URL_BASE}/${job.file}') format('woff2');
  unicode-range: ${e.range};
}`;
  })
  .join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'noto-serif-tc.css'), `${header}${body}\n`, 'utf8');
console.log(`CSS 写入 ${path.relative(ROOT, path.join(OUT_DIR, 'noto-serif-tc.css'))}`);

// 许可证原文（OFL 1.1）：随字体一起分发
const OFL_SOURCES = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/OFL.txt',
  'https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/LICENSE.txt',
];
if (!fs.existsSync(path.join(OUT_DIR, 'OFL.txt'))) {
  for (const url of OFL_SOURCES) {
    try {
      const txt = await fetchText(url);
      fs.writeFileSync(path.join(OUT_DIR, 'OFL.txt'), txt, 'utf8');
      console.log(`许可原文已保存（来源 ${url}）`);
      break;
    } catch (e) {
      console.log(`许可下载失败 ${url}: ${e.message}`);
    }
  }
}
