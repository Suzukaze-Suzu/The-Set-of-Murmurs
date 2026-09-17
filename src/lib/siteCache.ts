// 首屏文案的一致性机制（2026-09-17）
//
// 背景：首页 hero 的签名/简介、页脚标语、关于页正文，以前都是「先用 src 里写死的兜底文案渲染，
//       等 Supabase 请求回来再换成线上文案」。慢网（手机上直连 Supabase 常常好几秒甚至失败）时，
//       用户先看到的就是当初写死的旧文案，请求失败还会一直停在旧文案上——用户要求
//       「加载出来直接是现在的文案，不要出现之前的默认文字」。
//
// 取值优先级（三个来源，永远不主动去用 src 里那套旧兜底文案）：
//   ① localStorage 缓存：本机最近一次真正从线上拉到的文案（最新、也最贴近“现在”）
//   ② 构建时快照 src/lib/siteSnapshot.ts：上次构建那一刻的线上文案（新访客、清过缓存时用）
//   ③ 空字符串：宁可不显示，也不显示过期文字
// 拉到新数据后写回 ①；请求失败时保持当前值不动，不退回兜底值。
import type { Profile } from '../types';
import { SITE_SNAPSHOT } from './siteSnapshot';

export interface FooterText {
  slogan: string;
  caption: string;
  copyright: string;
}

const STORAGE_KEY = 'yiyuji.siteText.v1';

interface CacheShape {
  profile?: { nickname?: string; signature?: string; intro?: string };
  footer?: FooterText;
  about?: string;
}

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? (o as CacheShape) : {};
  } catch {
    // 隐私模式 / 配额满 / 脏数据：当成没有缓存
    return {};
  }
}

function patchCache(patch: CacheShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readCache(), ...patch }));
  } catch {
    /* 写不进去就算了，不影响渲染 */
  }
}

// 区分「这个来源没给这个字段」和「这个来源明确给了空字符串」：
// 后者是真值（例如站长把页脚副标题清空了），必须照用，不能被快照里的旧值顶回来。
function has(o: unknown, k: string): boolean {
  return !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
}

function field(cacheVal: unknown, snapVal: unknown, cacheHas: boolean, snapHas: boolean): string {
  if (cacheHas && typeof cacheVal === 'string') return cacheVal;
  if (snapHas && typeof snapVal === 'string') return snapVal;
  return '';
}

/** 首屏用的博主资料（不含 avatar：线上头像是超长 data URL，不进缓存也不进快照） */
export function initialProfile(): Profile {
  const c = readCache().profile;
  const s = SITE_SNAPSHOT.profile;
  return {
    nickname: field(c?.nickname, s.nickname, has(c, 'nickname'), has(s, 'nickname')),
    avatar: '',
    signature: field(c?.signature, s.signature, has(c, 'signature'), has(s, 'signature')),
    intro: field(c?.intro, s.intro, has(c, 'intro'), has(s, 'intro')),
  };
}

/** 首屏用的页脚文字 */
export function initialFooter(): FooterText {
  const c = readCache().footer;
  const s = SITE_SNAPSHOT.footer;
  return {
    slogan: field(c?.slogan, s.slogan, has(c, 'slogan'), has(s, 'slogan')),
    caption: field(c?.caption, s.caption, has(c, 'caption'), has(s, 'caption')),
    copyright:
      field(c?.copyright, s.copyright, has(c, 'copyright'), has(s, 'copyright')) ||
      'Powered by React + Vite · {year}',
  };
}

/** 首屏用的关于页正文 */
export function initialAbout(): string {
  const c = readCache();
  const s = SITE_SNAPSHOT;
  return field(c.about, s.about, has(c, 'about'), has(s, 'about'));
}

export function rememberProfile(p: Profile) {
  patchCache({ profile: { nickname: p.nickname, signature: p.signature, intro: p.intro } });
}

export function rememberFooter(f: FooterText) {
  patchCache({ footer: { slogan: f.slogan, caption: f.caption, copyright: f.copyright } });
}

export function rememberAbout(content: string) {
  patchCache({ about: content });
}
