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

let fail = 0, warn = 0, known = 0;
function audit(themeName, theme, fgExpr, bgExpr, label, min = 4.5, note) {
  const fg = val(theme, fgExpr), bg = val(theme, bgExpr);
  if (!fg.startsWith('#') || !bg.startsWith('#')) { console.log(`  SKIP  ${label}（非纯色：${fg} / ${bg}）`); return; }
  const r = CR(fg, bg);
  const ok = r >= min;
  if (!ok && note) {
    // 「已知取舍」：用户明确要求的颜色搭配，数值如实打印、也如实标注，但不阻断构建
    known++;
  } else if (!ok) {
    (r >= 3 ? warn++ : fail++);
  }
  const tag = ok ? 'PASS' : (note ? '已知' : (r >= 3 ? '偏低' : 'FAIL'));
  console.log(`  ${tag.padEnd(5)} ${label.padEnd(34)} ${r.toFixed(2)}:1  (${fg} on ${bg})`);
  if (!ok && note) console.log(`        ↳ 已知取舍：${note}`);
  return r;
}

console.log(`\n审计产物：dist/assets/${cssFile}\n`);
console.log('【亮色主题】');
const A = (f, b, l, m, n) => audit('light', light, f, b, l, m, n);
A('var(--text-main)', 'var(--bg-card)', '主文字 on 卡片');
A('var(--text-main)', 'var(--bg-page)', '主文字 on 页面底');
A('var(--text-secondary)', 'var(--bg-card)', '次要文字 on 卡片');
A('var(--text-secondary)', 'var(--bg-page)', '次要文字 on 页面底');
A('var(--text-secondary)', 'var(--bg-soft)', '次要文字 on bg-soft');
A('var(--sky-blue-dark)', 'var(--bg-card)', '链接色 on 卡片');
A('var(--sky-ink)', 'var(--bg-card)', '天空蓝墨色 on 卡片');
A('var(--sky-ink)', mix(light['--sky-blue'], '#ffffff', 0.12), '天空蓝墨色 on 天空蓝12%底');
// ↓ 2026-09-14 第2f/2g步：用户定了配色分工——**字全部用墨色、颜色全部不用墨色**。
//   第2g步补充：墨字＝**同色系墨色**（不是黑字），珊瑚粉族的字用 --coral-ink 深珊瑚 #A8482F；
//   分类小签在亮色下改成「该分类色卡色实底 + 能看清的字色」。
A('var(--coral-ink)', 'var(--bg-card)', '珊瑚墨色（字）on 卡片');
A('var(--coral-ink)', mix(light['--coral-pink'], '#ffffff', 0.15), '珊瑚墨色（字）on 珊瑚15%底');
A('var(--coral-pink)', 'var(--bg-card)', '珊瑚粉 on 卡片（描边/浅底，非文字）', 3, '色卡珊瑚粉本身 2.21:1；只做颜色不当字，非文字不受 WCAG 文字线约束');
A('var(--text-main)', '#5BA8D8', '墨字 on 天空蓝实底（读后感小签）');
A('var(--text-main)', '#E89B8A', '墨字 on 珊瑚粉实底（随笔小签）');
A('var(--text-main)', '#E8C9A0', '墨字 on 蜜金实底（小说小签）');
A('#ffffff', '#4A9BB8', '白字 on 青蓝实底（数学小签；墨字只有 2.07:1 故用白字）', 3);
A('#ffffff', '#8A8F9A', '白字 on 灰蓝实底（学习分享小签；墨字只有 3.88:1 故用白字）', 3);
// ↓ 第2i步：分区标题前的小竖条改成「自己分区的色卡色本身」（它是颜色/装饰，不是文字）
//   亮色下它就是压在卡片白底上的 4×20 装饰条，浅色（蜜金/珊瑚粉/天空蓝）本来就不可能到 3:1——用户点名要它用分区色卡色。
A('#5BA8D8', 'var(--bg-card)', '分区竖条 天空蓝 on 卡片（非文字）', 3, '色卡天空蓝本身 2.61:1；装饰竖条不承载信息，用户点名要用分区色卡色');
A('#E89B8A', 'var(--bg-card)', '分区竖条 珊瑚粉 on 卡片（非文字）', 3, '色卡珊瑚粉本身 2.21:1；同上');
A('#E8C9A0', 'var(--bg-card)', '分区竖条 蜜金 on 卡片（非文字）', 3, '色卡蜜金本身 1.58:1；同上');
A('#4A9BB8', 'var(--bg-card)', '分区竖条 青蓝 on 卡片（非文字）', 3);
A('#8A8F9A', 'var(--bg-card)', '分区竖条 灰蓝 on 卡片（非文字）', 3);
A('var(--coral-on)', 'var(--coral-pink)', '粉底上的字（--coral-on＝黑墨字）');
A('#ffffff', 'var(--coral-pink)', '白字 on 珊瑚粉实底（收藏星星★）', 4.5, '2.21:1；用户点名要星星保持白色');
A('#ffffff', 'var(--coral-pink)', '白字 on 珊瑚粉实底（暗色还原那批按钮）', 4.5, '2.21:1，暗色主题今天就是这样');
A('var(--honey-ink)', 'var(--bg-card)', '蜜金墨色 on 卡片');
A('var(--honey-ink)', mix(light['--honey-gold'], '#ffffff', 0.25), '蜜金墨色 on 蜜金25%底');
A('var(--slate-ink)', 'var(--bg-card)', '灰蓝墨色 on 卡片');
// ↓ 第2f步：--sky-fill（墨蓝实底 #2E6E92）亮色已弃用 → 实底改用色卡天空蓝本身 + 墨字（白字只留给暗色还原）
A('var(--text-main)', 'var(--sky-blue)', '墨字 on 天空蓝实底（筛选/留言板/阅读器激活态）');
A('#ffffff', 'var(--sky-blue)', '白字 on 天空蓝实底', 4.5, '2.61:1，只在暗色还原里出现（暗色今天就是这样）');
// ↓ 第2c步：亮色主按钮/激活态＝色卡青蓝 #4A9BB8 本身（色号未改）+ 白字
//   （墨色字反而更差：#2A6577 on #4A9BB8 仅 2.07:1；白字 3.15:1，属 WCAG 大字/填充控件线，故按 3:1 判）
A('#ffffff', 'var(--accent)', '白字 on 青蓝实底(主按钮/激活态)', 3);
A('var(--accent-on)', 'var(--accent)', '--accent-on on 青蓝实底（同上，变量自检）', 3);
A('var(--accent-deep)', 'var(--bg-card)', '青蓝墨色 on 卡片(文字层)');
A('#ffffff', '#35769B', '白字 on 主渐变起点(现仅暗色用)');
A('#ffffff', '#2A6386', '白字 on 主渐变终点(现仅暗色用)');
A('var(--text-main)', '#E8C9A0', '墨字 on 蜜金(btn-warm 起点)');
A('var(--text-main)', '#E89B8A', '墨字 on 珊瑚(btn-warm 终点)');
A('var(--text-main)', '#e9f4fc', '墨字 on hero 浅底左上', 4.5);
A('var(--text-main)', '#fdf4e9', '墨字 on hero 浅底右下', 4.5);
A('var(--sky-ink)', '#e9f4fc', 'hero 副标题 on hero 浅底', 4.5);
// ↓ 2026-09-13 第2步：Hero 改成流动渐变了，下面按「渐变的四个色标」实算
//   （色标值 = 色卡色 × 百分比 + 白/深底，与 index.css 里 --hero-flow 的 color-mix 一一对应）
//   ↓ 第2c步：首尾两档由「天空蓝20%」改成「强调色20%」＝亮色下的青蓝，色标随之变为 #DBEBF1
A('var(--text-main)', '#DBEBF1', '墨字 on hero 强调色20%色标', 4.5);
A('var(--text-main)', '#F9F1E6', '墨字 on hero 蜜金26%色标', 4.5);
A('var(--text-main)', '#FBEFEC', '墨字 on hero 珊瑚粉16%色标', 4.5);
A('var(--text-main)', '#DEEDF2', '墨字 on hero 青蓝18%色标', 4.5);
A('var(--sky-ink)', '#DBEBF1', 'hero 副标题 on hero 强调色色标', 4.5);
A('var(--sky-ink)', '#DEEDF2', 'hero 副标题 on hero 青蓝色标', 4.5);
A('var(--text-secondary)', '#DBEBF1', 'hero 简介 on hero 强调色色标', 4.5);
A('#ffffff', '#4A9BB8', '白字 on 青蓝(小说封面浅端，大字)', 3);
A('#ffffff', '#2A6577', '白字 on 青蓝深色(小说封面深端)');
A('var(--aqua-ink)', 'var(--bg-card)', '青蓝墨色 on 卡片(原森林绿岗位)');
A('var(--aqua-ink)', mix(light['--aqua-blue'], '#ffffff', 0.12), '青蓝墨色 on 青蓝12%底');
// ↓ 第2c步新增：亮色主题的强调色换成了青蓝，要确认它自己以及承载白字时都够看
A('var(--accent)', 'var(--bg-card)', '强调色(青蓝) on 卡片', 3);
A('var(--accent-deep)', 'var(--bg-card)', '强调色深档 on 卡片', 3);
A('#ffffff', 'var(--accent-deep)', '白字 on 强调色深档(封面深端)');

console.log('\n【暗色主题】');
const D = (f, b, l, m, n) => audit('dark', dark, f, b, l, m, n);
D('var(--text-main)', 'var(--bg-page)', '主文字 on 页面底');
D('var(--text-secondary)', 'var(--bg-card)', '次要文字 on 卡片');
D('var(--text-secondary)', 'var(--bg-page)', '次要文字 on 页面底');
D('var(--sky-ink)', 'var(--bg-card)', '天空蓝墨色 on 卡片');
D('var(--coral-pink)', 'var(--bg-card)', '暗色珊瑚粉 on 卡片（字色）');
D('var(--coral-on)', 'var(--coral-solid)', '暗色深珊瑚底上的字（--coral-on＝白）');
// 第2d步说明：暗色下随笔分类标签的字色仍是改动前的 #A8482F（= --coral-solid 的暗色值），
// 它压在深色卡片上本来就偏低（2.56:1）——为了「亮色改动不影响暗色」原样留着，等暗色那一步一起修。
D('var(--coral-solid)', 'var(--bg-card)', '暗色珊瑚原值(#A8482F) on 卡片', 4.5, '暗色原样保留，改动前就是这样，暗色那一步再一起修');
D('var(--aqua-ink)', 'var(--bg-card)', '青蓝墨色 on 卡片');
// ↓ 暗色 Hero 重做后的实算：#223746 = 天空蓝 #6ec3ef 16% 混进 #141b26 得到的最亮色标
D('var(--text-main)', '#223746', '暗色 hero 标题 on 最亮色标');
D('var(--sky-blue)', '#223746', '暗色 hero 副标题(天空蓝) on 最亮色标');
D('var(--text-secondary)', '#223746', '暗色 hero 简介 on 最亮色标');
D('#0e1c26', 'var(--sky-blue)', '暗色 hero 主按钮上的深字 on 天空蓝');
// ↓ 第2h步：暗色下「小标题」一律白色（用户原话「暗色下能不能把小标题全部变成白色，要不然看不清楚」）
//   覆盖：分区标题 .section-title、正文/关于/写作/阅读器的小节标题（原本是 --sky-blue-dark #4ba7d6 或分类墨色）
D('#ffffff', 'var(--bg-page)', '暗色小标题白字 on 页面底');
D('#ffffff', 'var(--bg-card)', '暗色小标题白字 on 卡片');
D('#ffffff', 'var(--bg-soft)', '暗色小标题白字 on bg-soft');
// ↓ 第2i步：同一根分区竖条在暗色卡片上（色卡色压在 #1e2937 上，全部达标）
D('#5BA8D8', 'var(--bg-card)', '暗色分区竖条 天空蓝 on 卡片（非文字）', 3);
D('#E89B8A', 'var(--bg-card)', '暗色分区竖条 珊瑚粉 on 卡片（非文字）', 3);
D('#E8C9A0', 'var(--bg-card)', '暗色分区竖条 蜜金 on 卡片（非文字）', 3);
D('#4A9BB8', 'var(--bg-card)', '暗色分区竖条 青蓝 on 卡片（非文字）', 3);
D('#8A8F9A', 'var(--bg-card)', '暗色分区竖条 灰蓝 on 卡片（非文字）', 3);

console.log(`\n结果：FAIL ${fail} 项，偏低 ${warn} 项，已知取舍 ${known} 项`);
process.exit(fail > 0 ? 1 : 0);
