/**
 * 校验自托管思源宋体分片的「声明 vs 真实字形」、覆盖面与体积
 * 用法：node scripts/check-font-coverage.mjs [--online]
 *  1) 逐片解析 woff2 的真实 cmap，和 CSS 里声明的 unicode-range 对账
 *     —— ⚠️ 这一步是必须的：声明了却没有字形的字，浏览器只会回退到系统字体，
 *        桌面端（本机装着思源宋/系统宋体）几乎看不出，手机端会变成黑体，很难查。
 *  2) 把站点源码/文案（--online 再加线上 Supabase 内容）里出现过的所有汉字，
 *     逐字对照真实字形，列出缺字；
 *  3) 汇报每一片的字符数与字节。
 * 说明：真·片外的字会回退到字体栈里的系统衬线，属于已知取舍；但「声明了却没有字形」是 bug。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = path.join(ROOT, 'public', 'fonts', 'noto-serif-tc');
const CSS = path.join(FONT_DIR, 'noto-serif-tc.css');
const css = fs.readFileSync(CSS, 'utf8');

const WITH_ONLINE = process.argv.includes('--online');

// ---- woff2 → 真实 cmap（浏览器就是这么看字体的）----
const KNOWN_TAGS = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
const u16 = (b, o) => b.readUInt16BE(o);
const u32 = (b, o) => b.readUInt32BE(o);
function readBase128(b, o) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const byte = b[o++];
    v = (v << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return [v >>> 0, o];
  }
  throw new Error('坏掉的 UIntBase128');
}
function woff2Cmap(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('不是 woff2');
  const numTables = u16(buf, 12);
  let o = 48;
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[o++];
    let tag;
    if ((flags & 0x3f) === 0x3f) { tag = buf.toString('latin1', o, o + 4); o += 4; } else tag = KNOWN_TAGS[flags & 0x3f];
    const tv = (flags >> 6) & 3;
    let orig; [orig, o] = readBase128(buf, o);
    const transformed = tag === 'glyf' || tag === 'loca' ? tv !== 3 : tv !== 0;
    let tl = null;
    if (transformed) [tl, o] = readBase128(buf, o);
    dir.push({ tag, orig, stored: transformed ? tl : orig });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(o, o + u32(buf, 20)));
  let off = 0;
  for (const t of dir) {
    if (t.tag === 'cmap') return parseCmap(data.subarray(off, off + t.orig));
    off += t.stored; // 解压流里表与表之间没有对齐填充（sum(stored) == 流长度）
  }
  throw new Error('没有 cmap 表');
}
function parseCmap(b) {
  const cps = new Set();
  const n = u16(b, 2);
  for (let i = 0; i < n; i++) {
    const so = u32(b, 4 + i * 8 + 4);
    const fmt = u16(b, so);
    if (fmt === 4) {
      const segCount = u16(b, so + 6) / 2;
      const endO = so + 14, startO = endO + segCount * 2 + 2, deltaO = startO + segCount * 2, rangeO = deltaO + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const end = u16(b, endO + s * 2), start = u16(b, startO + s * 2);
        const delta = b.readInt16BE(deltaO + s * 2), ro = u16(b, rangeO + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end && c !== 0x10000; c++) {
          let gid;
          if (ro === 0) gid = (c + delta) & 0xffff;
          else {
            const gi = rangeO + s * 2 + ro + (c - start) * 2;
            if (gi + 2 > b.length) continue;
            gid = u16(b, gi);
            if (gid !== 0) gid = (gid + delta) & 0xffff;
          }
          if (gid !== 0) cps.add(c);
        }
      }
    } else if (fmt === 12) {
      const ng = u32(b, so + 12);
      for (let g = 0; g < ng; g++) {
        const p = so + 16 + g * 12;
        const st = u32(b, p), en = u32(b, p + 4);
        for (let c = st; c <= en; c++) cps.add(c);
      }
    }
  }
  return cps;
}

const blocks = css.split('@font-face').slice(1);
console.log(`@font-face 片数：${blocks.length}`);

let declaredTotal = 0;
let overClaim = 0;      // 声明了却没有字形（bug）
const covered = new Set();  // 真实有字形的码位
const owner = new Map();    // 码位 → 第一个声明它的片（用来查重叠）
const overlaps = new Map(); // 码位 → [片名...]（被两片同时声明：会变成优先级不明的重复声明）
console.log('  片名                 声明码位  真实字形  声明但无字形   体积');
for (const b of blocks) {
  const url = (b.match(/url\('([^']+)'\)/) || [])[1];
  const shard = path.basename(url.split('?')[0]);
  const declared = [];
  for (const m of b.matchAll(/U\+([0-9a-fA-F?]+)(?:-([0-9a-fA-F]+))?/g)) {
    const a = m[1];
    if (a.includes('?')) {
      declared.push(...[...Array(16)].map((_, i) => parseInt(a.replace('?', i.toString(16)), 16)));
      continue;
    }
    const lo = parseInt(a, 16);
    const hi = m[2] ? parseInt(m[2], 16) : lo;
    for (let cp = lo; cp <= hi; cp++) declared.push(cp);
  }
  for (const cp of declared) {
    if (owner.has(cp)) overlaps.set(cp, [...(overlaps.get(cp) ?? [owner.get(cp)]), shard]);
    else owner.set(cp, shard);
  }
  const file = path.join(ROOT, 'public', url.split('?')[0].replace(/^\//, ''));
  const actual = woff2Cmap(file);
  for (const cp of actual) covered.add(cp);
  const missing = declared.filter((cp) => !actual.has(cp));
  declaredTotal += declared.length;
  overClaim += missing.length;
  const size = fs.statSync(file).size;
  console.log(
    `  ${path.basename(url).padEnd(20)} ${String(declared.length).padStart(7)} ${String(actual.size).padStart(9)} ` +
      `${String(missing.length).padStart(13)} ${(size / 1024).toFixed(1).padStart(8)}KB` +
      (missing.length ? `  ← ${missing.slice(0, 20).map((c) => String.fromCharCode(c)).join('')}` : ''),
  );
}
const totalBytes = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2'))
  .reduce((n, f) => n + fs.statSync(path.join(FONT_DIR, f)).size, 0);
console.log(`本地分片合计 ${(totalBytes / 1048576).toFixed(2)}MB（浏览器只下 unicode-range 命中的片）`);
console.log(`声明码位合计 ${declaredTotal}，真实有字形 ${covered.size}`);
console.log(overClaim === 0
  ? '✅ 没有任何「声明了却没有字形」的码位'
  : `❌ ${overClaim} 个码位声明了却没有字形（会导致回退系统字体，必须重切）`);

// 各片 unicode-range 必须两两不相交：同族多片都声明一个码位时，到底用哪一片由声明顺序决定，
// 万一先命中的那片没字形就又会回退系统字体（补字片就是靠「不相交」来保证一定接得住的）。
if (overlaps.size === 0) {
  console.log('✅ 各片 unicode-range 两两不相交（每个码位只有一片负责）');
} else {
  const sample = [...overlaps.entries()].slice(0, 20);
  console.log(`❌ ${overlaps.size} 个码位被两片以上同时声明：` +
    sample.map(([cp, names]) => `${String.fromCharCode(cp)}(${names.join('+')})`).join(' '));
}

// ---- index.html 的 preload 必须和 CSS 里的 URL 逐字一致，否则同一份字体文件会被下载两次 ----
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssSrc = new Set([...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]));
const preloads = [...html.matchAll(/<link rel="preload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const badPreload = preloads.filter((h) => !cssSrc.has(h));
console.log(preloads.length === 0
  ? '⚠️ index.html 里没有字体 preload'
  : badPreload.length === 0
    ? `✅ index.html 的 ${preloads.length} 个字体 preload 与 CSS 的 src 完全一致（不会重复下载）`
    : `❌ preload 与 CSS 的 src 对不上（会重复下载）：${badPreload.join(' , ')}`);

// ---- 站点用字对账 ----
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
if (WITH_ONLINE) {
  const ts = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'supabase.ts'), 'utf8');
  const url = ts.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
  const key = ts.match(/(eyJ[A-Za-z0-9_\-.]{40,}|sb_publishable_[A-Za-z0-9_\-]+)/)[0];
  for (const table of ['articles', 'novels', 'novel_chapters', 'about_versions', 'site_text', 'comments', 'guestbook', 'gallery', 'friend_links', 'profiles']) {
    try {
      const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=2000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (!r.ok) continue;
      const dump = JSON.stringify(await r.json());
      for (const ch of dump) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x3400 && cp <= 0x9fff) chars.add(ch);
      }
      console.log(`  线上表 ${table} 已计入`);
    } catch { /* 网络不通就跳过 */ }
  }
}

const missing = [...chars].filter((ch) => !covered.has(ch.codePointAt(0)));
console.log(`源码/文案里出现汉字 ${chars.size} 个${WITH_ONLINE ? '（含线上内容）' : ''}`);
if (missing.length === 0) console.log('✅ 全部在托管片内真实覆盖（无缺字）');
else console.log(`⚠️ ${missing.length} 个不在片内（会回退系统衬线）：${missing.join('')}`);

const probe = '语这说们时发国学会话对钱铁开关闭汉字体测试网络软头电脑后里广场让请谢银针钟钢镜';
const probeMissing = [...probe].filter((ch) => !covered.has(ch.codePointAt(0)));
console.log(probeMissing.length === 0 ? '✅ 简体探针字全覆盖' : `⚠️ 简体探针缺字：${probeMissing.join('')}`);

// 繁体常用字探针：这些字若不在片内会回退系统衬线（正文偶尔出现繁体时的观感提醒）
const tradProbe = '語這說們時發國學會話對錢鐵開關閉漢門風雲龍鳳臺灣體驗讀寫點線';
const tradMissing = [...tradProbe].filter((ch) => !covered.has(ch.codePointAt(0)));
console.log(tradMissing.length === 0 ? '✅ 繁体探针字全覆盖' : `⚠️ 繁体探针字回退系统衬线：${tradMissing.join('')}`);
process.exit(overClaim === 0 && overlaps.size === 0 ? 0 : 1);
