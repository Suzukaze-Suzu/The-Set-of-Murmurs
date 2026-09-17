// 构建时脚本：把「线上此刻的站点文案」快照进代码 → src/lib/siteSnapshot.ts
//
// 为什么需要它（2026-09-17）：
//   首页 hero 的签名/简介、页脚标语、关于页正文以前都是「先渲染 src 里写死的兜底文案，
//   等 Supabase 请求回来再换成线上文案」。慢网（手机上直连 Supabase 尤其慢/易失败）时，
//   先看到的就是那几个月前写死的旧文案（“外冷内热，认真记录每个小瞬间”这类），
//   请求失败时甚至会一直停在旧文案上。用户的要求是「加载出来直接是现在的文案」。
//   于是：构建时先抓一次线上真值塞进 bundle，首屏（以及离线）都直接用真值渲染。
//   运行期的取值优先级见 src/lib/siteCache.ts（localStorage 缓存 > 本快照 > 空）。
//
// 约定：
//   - 数据没变化时不重写文件（避免每次构建都产生 git diff）
//   - 抓取失败不阻断构建：保留已有快照文件；文件不存在就写一个空壳，保证 tsc 能过
//   - 不含 avatar（线上头像是一大段 base64 data URL，进快照会让 bundle 暴涨）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'lib', 'siteSnapshot.ts');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';

// 管理员（站长）的 UUID 是「博主资料」那一行，从 AuthContext 里读，避免两处写死后走岔
function readAdminUuid() {
  try {
    const src = readFileSync(join(ROOT, 'src', 'context', 'AuthContext.tsx'), 'utf-8');
    const m = src.match(/ADMIN_UUID\s*=\s*['"]([0-9a-fA-F-]{36})['"]/);
    if (m) return m[1];
  } catch { /* 读不到就用下面的兜底值 */ }
  return 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302';
}

const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!res.ok) throw new Error(`Supabase ${path} 返回 ${res.status}`);
  return res.json();
}

function render(snap) {
  return `// ⚠️ 本文件由 scripts/generate-site-snapshot.mjs 在构建时自动维护，不要手改。
//
// 内容＝上次构建那一刻「线上真实的站点文案」。用途：让首屏（以及断网/请求失败时）
// 直接渲染线上现在的文字，而不是 src 里写死的旧兜底文案。
// 取值优先级：localStorage 缓存 > 本快照 > 空字符串，见 src/lib/siteCache.ts。
// 数据没变化时构建不会重写本文件；改过线上文案后重新构建会更新它（记得一起提交）。

export interface SiteSnapshot {
  profile: { nickname: string; signature: string; intro: string };
  footer: { slogan: string; caption: string; copyright: string };
  about: string;
}

export const SITE_SNAPSHOT: SiteSnapshot = ${JSON.stringify(snap, null, 2)};
`;
}

function emptySnapshot() {
  return {
    profile: { nickname: '', signature: '', intro: '' },
    footer: { slogan: '', caption: '', copyright: 'Powered by React + Vite · {year}' },
    about: '',
  };
}

async function main() {
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

  const snap = {
    profile: {
      nickname: p.nickname || '',
      signature: p.signature || '',
      intro: p.intro || '',
    },
    footer: {
      slogan: map.footer_slogan ?? '',
      caption: map.footer_caption ?? '',
      copyright: map.footer_copyright ?? 'Powered by React + Vite · {year}',
    },
    about,
  };

  const next = render(snap);
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf-8') : '';
  if (prev === next) {
    console.log('[snapshot] 线上文案与快照一致，未改动 src/lib/siteSnapshot.ts');
    return;
  }
  writeFileSync(OUT, next, 'utf-8');
  console.log('[snapshot] 已更新 src/lib/siteSnapshot.ts：');
  console.log(`[snapshot]   签名：${snap.profile.signature || '(空)'}`);
  console.log(`[snapshot]   页脚标语：${snap.footer.slogan || '(空)'}`);
  console.log(`[snapshot]   关于页正文：${about.length} 字`);
  if (prev) console.warn('[snapshot] 本次内容有变化 —— 记得把 src/lib/siteSnapshot.ts 一起提交');
}

main().catch((err) => {
  console.warn('[snapshot] 抓取失败（不阻断构建）：', err && err.message ? err.message : err);
  if (!existsSync(OUT)) {
    writeFileSync(OUT, render(emptySnapshot()), 'utf-8');
    console.warn('[snapshot] 已写入空壳快照，保证类型检查能过；下次构建成功会自动补齐');
  } else {
    console.warn('[snapshot] 沿用已有的 src/lib/siteSnapshot.ts');
  }
});
