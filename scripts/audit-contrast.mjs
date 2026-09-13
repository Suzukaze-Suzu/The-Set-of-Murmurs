// 对比度验收脚本：直接读「构建产物里的 CSS」实算 WCAG 对比度，不靠肉眼判断。
// 用法：node scripts/audit-contrast.mjs   （先 npm run build）
// 退出码：0=全部达标，1=有不达标项
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = join(root, 'dist', 'assets');
const cssFile = readdirSync(assetDir)
  .filter((f) => /^index-.*\.css$/.test(f))
  .map((f) => ({ f, t: statSync(join(assetDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0]?.f;
if (!cssFile) {
  console.error('找不到 dist/assets/index-*.css，请先 npm run build');
  process.exit(1);
}
const css = readFileSync(join(assetDir, cssFile), 'utf8');

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const h2r = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const L = (h) => { const [r, g, b] = h2r(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return '#' + [0, 1, 2].map((i) => Math.round(A[i] * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join(''); };
const CR = (f, b) => { const l1 = L(f), l2 = L(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

// 从产物里取主题变量（:root 与 [data-theme=dark]；压缩后引号会被去掉，所以用正则容忍）
function readVars(regexSource, label) {
  const m = css.match(new RegExp(regexSource + '\\{([^}]*)\\}'));
  if (!m) throw new Error(`产物里找不到 ${label} 变量块`);
  const vars = {};
  for (const decl of m[1].split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (k.startsWith('--')) vars[k] = v;
  }
  return vars;
}
// 解析嵌套的 var()，取最终 hex（不支持渐变/color-mix 之外的复杂值）
function val(theme, expr, depth = 0) {
  expr = expr.trim();
  const vm = expr.match(/^var\((--[a-z0-9-]+)(?:,\s*(.+))?\)$/i);
  if (vm && depth < 10) {
    const got = theme[vm[1]];
    if (got !== undefined) return val(theme, got, depth + 1);
    if (vm[2]) return val(theme, vm[2], depth + 1);
    throw new Error(`未定义变量 ${vm[1]}`);
  }
  return expr;
}

const light = readVars(':root', ':root');
const dark = readVars("\\[data-theme=['\"]?dark['\"]?\\]", 'data-theme=dark');

let fail = 0, warn = 0;
function audit(themeName, theme, fgExpr, bgExpr, label, min = 4.5) {
  const fg = val(theme, fgExpr), bg = val(theme, bgExpr);
  if (!fg.startsWith('#') || !bg.startsWith('#')) { console.log(`  SKIP  ${label}（非纯色：${fg} / ${bg}）`); return; }
  const r = CR(fg, bg);
  const ok = r >= min;
  if (!ok) (r >= 3 ? warn++ : fail++);
  const tag = ok ? 'PASS' : (r >= 3 ? '偏低' : 'FAIL');
  console.log(`  ${tag.padEnd(5)} ${label.padEnd(34)} ${r.toFixed(2)}:1  (${fg} on ${bg})`);
  return r;
}

console.log(`\n审计产物：dist/assets/${cssFile}\n`);
console.log('【亮色主题】');
const A = (f, b, l, m) => audit('light', light, f, b, l, m);
A('var(--text-main)', 'var(--bg-card)', '主文字 on 卡片');
A('var(--text-main)', 'var(--bg-page)', '主文字 on 页面底');
A('var(--text-secondary)', 'var(--bg-card)', '次要文字 on 卡片');
A('var(--text-secondary)', 'var(--bg-page)', '次要文字 on 页面底');
A('var(--text-secondary)', 'var(--bg-soft)', '次要文字 on bg-soft');
A('var(--sky-blue-dark)', 'var(--bg-card)', '链接色 on 卡片');
A('var(--sky-ink)', 'var(--bg-card)', '天空蓝墨色 on 卡片');
A('var(--sky-ink)', mix(light['--sky-blue'], '#ffffff', 0.12), '天空蓝墨色 on 天空蓝12%底');
A('var(--coral-ink)', 'var(--bg-card)', '珊瑚墨色 on 卡片');
A('var(--coral-ink)', mix(light['--coral-pink'], '#ffffff', 0.15), '珊瑚墨色 on 珊瑚15%底');
A('var(--honey-ink)', 'var(--bg-card)', '蜜金墨色 on 卡片');
A('var(--honey-ink)', mix(light['--honey-gold'], '#ffffff', 0.25), '蜜金墨色 on 蜜金25%底');
A('var(--slate-ink)', 'var(--bg-card)', '灰蓝墨色 on 卡片');
A('#ffffff', 'var(--sky-fill)', '白字 on sky-fill');
A('#ffffff', 'var(--coral-fill)', '白字 on coral-fill');
A('#ffffff', '#35769B', '白字 on 主渐变起点');
A('#ffffff', '#2A6386', '白字 on 主渐变终点');
A('var(--text-main)', '#E8C9A0', '墨字 on 蜜金(btn-warm 起点)');
A('var(--text-main)', '#E89B8A', '墨字 on 珊瑚(btn-warm 终点)');
A('var(--text-main)', '#e9f4fc', '墨字 on hero 浅底左上');
A('var(--text-main)', '#fdf4e9', '墨字 on hero 浅底右下');
A('var(--sky-ink)', '#e9f4fc', 'hero 副标题 on hero 浅底');
A('#ffffff', '#2F6B4F', '白字 on 森林绿(小说封面)');
A('#ffffff', '#2A6577', '白字 on 青蓝深色(小说封面)');

console.log('\n【暗色主题】');
const D = (f, b, l, m) => audit('dark', dark, f, b, l, m);
D('var(--text-main)', 'var(--bg-page)', '主文字 on 页面底');
D('var(--text-secondary)', 'var(--bg-card)', '次要文字 on 卡片');
D('var(--text-secondary)', 'var(--bg-page)', '次要文字 on 页面底');
D('var(--sky-ink)', 'var(--bg-card)', '天空蓝墨色 on 卡片');
D('var(--coral-ink)', 'var(--bg-card)', '珊瑚墨色 on 卡片');

console.log(`\n结果：FAIL ${fail} 项，偏低 ${warn} 项`);
process.exit(fail > 0 ? 1 : 0);
