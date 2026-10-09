// ============================================================================
// 呓语集 · 英文线首屏预载（2026-10-09）
// ----------------------------------------------------------------------------
// 用户原话：「英文站点我不希望依附中文站点，而是先加载英文翻译，然后没上线的话再变为中文」
//
// 改前的问题：文章数据先到（中文 articles 表），译文要在**第二个请求**回来之后才套上去
//   → 英文页首帧是中文，随后跳成英文（TranslationContext 里的 ready 标志本来就是为这个准备的，
//     但当时没有任何页面用它）。
//
// 现在的口径：**英文线在挂载 React 之前先把「已上线（reviewed）」的译文拿回来**，
//   首帧直接就是英文；某篇没有 reviewed 译文 → 那一篇逐字段回退中文原文
//   （A 口径，与 src/lib/translations.ts 的 localizeArticle 同一套规则，不加任何标记）。
//   这期间屏幕上留着 index.html 里既有的 #splash 加载屏——**不新增任何控件、动画或色号**。
//
// 三条纪律：
//   ① **中文线一个请求都不发**（locale !== 'en' 直接短路），中文站完全不受英文线影响；
//   ② 有超时上限（3s）且吞掉所有错误：拿不到就照常挂载，行为退回改动前（显示中文原文），
//      绝不让一次断网把整站卡在加载屏上（index.html 那个 8s 失败提示也不会被触发）；
//   ③ 一次会话只发一轮请求（模块级缓存）：main.tsx 的预载与 TranslationContext 的加载
//      共用同一个 promise，不重复打数据库。
// ============================================================================

import type { Locale } from '../i18n';
import { fetchReviewedTranslations, type ArticleTranslation } from './translations';
import { fetchReviewedTagTranslations, type TagMap } from './tagTranslations';

export interface PreloadedTranslations {
  /** article_id → 译文（公开页只会有 reviewed 的） */
  map: Record<string, ArticleTranslation>;
  /** 标签词典（中文标签 → 英文） */
  tags: TagMap;
}

/** 预载上限：超过就照常挂载（译文晚到也不影响，TranslationContext 还会再收一次） */
const TIMEOUT_MS = 3000;

const pending = new Map<Locale, Promise<PreloadedTranslations>>();
const landed = new Map<Locale, PreloadedTranslations>();

async function load(locale: Locale): Promise<PreloadedTranslations> {
  try {
    // 译文与标签词典并发拉，别串起来等
    const [list, tags] = await Promise.all([
      fetchReviewedTranslations(locale),
      fetchReviewedTagTranslations(locale),
    ]);
    const map: Record<string, ArticleTranslation> = {};
    for (const tr of list) map[tr.articleId] = tr;
    const out: PreloadedTranslations = { map, tags };
    landed.set(locale, out);
    return out;
  } catch (err) {
    // 表没建 / 网络断：静默降级成「没有译文」，页面显示中文原文（与改动前一致）
    console.warn('[i18n] 首屏预载译文失败，英文页回退中文原文：', err);
    return { map: {}, tags: {} };
  }
}

/**
 * 开始预载（幂等）。`force = true` 时丢掉缓存重新拉一次——译文工作台保存后用。
 * 返回的 promise **永远不会 reject**；等多久都行（挂了会一直挂着，由调用方决定要不要设上限）。
 */
export function startPreload(locale: Locale, force = false): Promise<PreloadedTranslations> {
  // ① 中文线不读译文表、不读标签词典
  if (locale !== 'en') return Promise.resolve({ map: {}, tags: {} });

  if (force) {
    pending.delete(locale);
    landed.delete(locale);
  }
  let p = pending.get(locale);
  if (!p) {
    p = load(locale);
    pending.set(locale, p);
  }
  return p;
}

/**
 * 挂载前用（main.tsx）：最多等 TIMEOUT_MS —— 超时先返回 null 照常挂载（屏幕上留着既有 #splash），
 * 后台那次请求仍在跑，TranslationContext 拿到后照样会把英文换上（不会永远停在中文）。
 */
export function preloadForBoot(locale: Locale): Promise<PreloadedTranslations | null> {
  if (locale !== 'en') return Promise.resolve(null);
  return Promise.race([
    startPreload(locale),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
}

/** 同步取「已经落地的那一份」（只给 useState 初值用；没到就是 undefined） */
export function takePreloaded(locale: Locale): PreloadedTranslations | undefined {
  return landed.get(locale);
}
