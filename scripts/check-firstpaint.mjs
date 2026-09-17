// 验收探针（2026-09-17）：证明「首屏直接就是线上现在的文案」
//
// 背景：首页 hero 的签名/简介、页脚标语、关于页正文曾经会先渲染 src 里写死的旧兜底文案，
//       慢网/请求失败时用户看到的就是那套过期的文字。改成「本机缓存 > 构建时快照 > 空」之后，
//       只要构建时的快照＝线上真值，首屏（含断网）渲染的就是现在的文案。
//       本脚本就是来实测这一条的。
//
// 用法：
//   node scripts/check-firstpaint.mjs            # 比对快照 vs 线上 + 扫 dist 产物
//   node scripts/check-firstpaint.mjs --online   # 再拉线上正在跑的 JS，扫同一批断言
//
// 判定：
//   [PASS] 快照与线上真值逐字一致 → 首屏即「现在的文案」
//   [FAIL] 有不一致（或产物里还残留旧兜底文案）→ 重新构建并部署
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ONLINE = process.argv.includes('--online');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';
const SITE_URL = (process.env.SITE_URL || 'https://www.the-set-of-murmurs.me').replace(/\/+$/, '');
const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

// 2026-09-17 之前会「先闪出来」的那套旧兜底文案（改完之后产物里不该再出现）
const LEGACY_TEXT = [
  '外冷内热，认真记录每个小瞬间',
  '像凉风凉一样认真记录每个小瞬间',
  '记录动漫、随笔、读后感与数学学习。像凉风凉一样',
];

let fails = 0;
const pass = (m) => console.log('  [PASS] ' + m);
const fail = (m) => { fails++; console.log('  [FAIL] ' + m); };

function readSnapshot() {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'siteSnapshot.ts'), 'utf-8');
  const m = src.match(/export const SITE_SNAPSHOT: SiteSnapshot = ([\s\S]*?);\s*$/);
  if (!m) throw new Error('解析不出 src/lib/siteSnapshot.ts 里的 SITE_SNAPSHOT');
  return JSON.parse(m[1]);
}

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!res.ok) throw new Error(`Supabase ${path} 返回 ${res.status}`);
  return res.json();
}

function readAdminUuid() {
  const src = readFileSync(join(ROOT, 'src', 'context', 'AuthContext.tsx'), 'utf-8');
  const m = src.match(/ADMIN_UUID\s*=\s*['"]([0-9a-fA-F-]{36})['"]/);
  return m ? m[1] : '';
}

function bundleFiles() {
  const dir = join(ROOT, 'dist', 'assets');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => join(dir, f));
}

async function onlineJsFiles() {
  const html = await (await fetch(`${SITE_URL}/`)).text();
  const files = [...html.matchAll(/\/assets\/[^"']+\.js/g)].map((m) => m[0]);
  const out = [];
  for (const f of [...new Set(files)]) {
    try {
      const res = await fetch(SITE_URL + f);
      if (res.ok) out.push({ name: f, text: await res.text() });
    } catch { /* 拉不到就跳过 */ }
  }
  return out;
}

async function main() {
  console.log('=== 首屏文案探针（快照 vs 线上）===');
  const snap = readSnapshot();
  const admin = readAdminUuid();
  const [profiles, texts, abouts] = await Promise.all([
    rest(`profiles?select=nickname,signature,intro&id=eq.${admin}`),
    rest('site_texts?select=key,content'),
    rest('about_versions?select=content&order=date.desc&limit=1'),
  ]);
  const p = (profiles && profiles[0]) || {};
  const map = {};
  (texts || []).forEach((r) => { if (r && r.key) map[r.key] = r.content ?? ''; });
  const about = (abouts && abouts[0] && abouts[0].content) || '';

  const live = {
    'hero 签名': [snap.profile.signature, p.signature || ''],
    'hero 简介': [snap.profile.intro, p.intro || ''],
    '页脚标语': [snap.footer.slogan, map.footer_slogan ?? ''],
    '页脚副标题': [snap.footer.caption, map.footer_caption ?? ''],
    '关于页正文': [snap.about, about],
  };
  for (const [name, [s, l]] of Object.entries(live)) {
    if (s === l) pass(`${name}：快照与线上逐字一致（${s.length} 字）`);
    else fail(`${name}不一致\n         快照＝${JSON.stringify(s.slice(0, 60))}\n         线上＝${JSON.stringify(l.slice(0, 60))}`);
  }

  console.log('=== 旧兜底文案是否已从产物里消失 ===');
  const check = (label, text) => {
    for (const legacy of LEGACY_TEXT) {
      if (text.includes(legacy)) { fail(`${label} 仍有旧兜底文案：${legacy}`); return; }
    }
    const hit = [snap.profile.signature, snap.profile.intro, snap.footer.slogan].filter((s) => s && text.includes(s));
    if (hit.length) pass(`${label} 含线上文案 ${hit.length} 条、且无旧兜底文案`);
    else fail(`${label} 里找不到线上文案——快照可能没被打进产物`);
  };

  const files = bundleFiles();
  if (files.length) {
    const text = files.map((f) => readFileSync(f, 'utf-8')).join('\n');
    check(`dist 产物（${files.length} 个 js）`, text);
  } else {
    console.log('  [SKIP] 没有 dist 产物（先跑 npm run build）');
  }

  if (ONLINE) {
    const online = await onlineJsFiles();
    if (online.length) check(`线上 JS（${online.map((o) => o.name).join(', ')}）`, online.map((o) => o.text).join('\n'));
    else fail('拉不到线上 JS 产物');
  }

  console.log(fails === 0 ? '\n结果：全部 PASS —— 首屏即线上现在的文案' : `\n结果：${fails} 项 FAIL`);
  process.exitCode = fails === 0 ? 0 : 1;
}

main().catch((e) => { console.error('探针执行失败：', e && e.message ? e.message : e); process.exitCode = 1; });
