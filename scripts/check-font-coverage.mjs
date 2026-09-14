/**
 * 校验自托管思源宋体 TC（按字频切片）的覆盖面与体积
 * 用法：node scripts/check-font-coverage.mjs
 *  1) 把站点源码/文案里出现过的所有汉字，逐字对照 CSS 里声明的 unicode-range，列出缺字；
 *  2) 汇报每一片的字符数与字节。
 * 说明：片外的字不是错，只是会回退到字体栈里的系统衬线（栈尾有 Noto Serif SC / Songti 兜底）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = path.join(ROOT, 'public', 'fonts', 'noto-serif-tc');
const CSS = path.join(FONT_DIR, 'noto-serif-tc.css');
const css = fs.readFileSync(CSS, 'utf8');

const blocks = css.split('@font-face').slice(1);
console.log(`@font-face 片数：${blocks.length}`);

const covered = new Set();
for (const m of css.matchAll(/U\+([0-9a-fA-F?]+)(?:-([0-9a-fA-F]+))?/g)) {
  const a = m[1];
  if (a.includes('?')) {
    const lo = parseInt(a.replace(/\?/g, '0'), 16);
    const hi = parseInt(a.replace(/\?/g, 'f'), 16);
    for (let cp = lo; cp <= hi; cp++) covered.add(cp);
    continue;
  }
  const lo = parseInt(a, 16);
  const hi = m[2] ? parseInt(m[2], 16) : lo;
  for (let cp = lo; cp <= hi; cp++) covered.add(cp);
}

for (const b of blocks) {
  const url = (b.match(/url\('([^']+)'\)/) || [])[1];
  const weight = (b.match(/font-weight:\s*([^;]+);/) || [])[1]?.trim();
  const cpCount = [...b.matchAll(/U\+([0-9a-fA-F?]+)(?:-([0-9a-fA-F]+))?/g)].reduce((n, m) => {
    if (m[1].includes('?')) return n + 1;
    const lo = parseInt(m[1], 16);
    const hi = m[2] ? parseInt(m[2], 16) : lo;
    return n + (hi - lo + 1);
  }, 0);
  const size = url ? fs.statSync(path.join(ROOT, 'public', url)).size : 0;
  console.log(`  ${path.basename(url ?? '?').padEnd(18)} 字重 ${weight}  ${String(cpCount).padStart(5)} 字  ${(size / 1024).toFixed(1)}KB`);
}
const totalBytes = [...css.matchAll(/url\('([^']+)'\)/g)].reduce(
  (n, m) => n + fs.statSync(path.join(ROOT, 'public', m[1])).size,
  0,
);
console.log(`本地分片合计 ${(totalBytes / 1048576).toFixed(2)}MB（浏览器只下 unicode-range 命中的片）`);
console.log(`unicode-range 声明覆盖码位：${covered.size}`);

const exts = new Set(['.ts', '.tsx', '.css', '.html', '.md', '.mjs', '.json']);
const skipDirs = new Set(['node_modules', 'dist', '.git', 'fonts']);
const chars = new Set();
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (skipDirs.has(ent.name)) continue;
      walk(full);
      continue;
    }
    if (!exts.has(path.extname(ent.name))) continue;
    for (const ch of fs.readFileSync(full, 'utf8')) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x3400 && cp <= 0x9fff) chars.add(ch);
    }
  }
}
walk(path.join(ROOT, 'src'));
walk(path.join(ROOT, 'public'));

const missing = [...chars].filter((ch) => !covered.has(ch.codePointAt(0)));
console.log(`源码/文案里出现汉字 ${chars.size} 个`);
if (missing.length === 0) console.log('✅ 全部在托管片内覆盖（无缺字）');
else console.log(`⚠️ ${missing.length} 个不在片内（会回退系统衬线）：${missing.join('')}`);

const probe = '语这说们时发国学会话对钱铁开关闭汉字体测试网络软头电脑后里广场让请谢银针钟钢镜';
const probeMissing = [...probe].filter((ch) => !covered.has(ch.codePointAt(0)));
console.log(probeMissing.length === 0 ? '✅ 简体探针字全覆盖' : `⚠️ 简体探针缺字：${probeMissing.join('')}`);

// 繁体常用字探针：这些字若不在片内会回退系统衬线（正文偶尔出现繁体时的观感提醒）
const tradProbe = '語這說們時發國學會話對錢鐵開關閉漢門風雲龍鳳臺灣體驗讀寫點線';
const tradMissing = [...tradProbe].filter((ch) => !covered.has(ch.codePointAt(0)));
console.log(tradMissing.length === 0 ? '✅ 繁体探针字全覆盖' : `⚠️ 繁体探针字回退系统衬线：${tradMissing.join('')}`);
