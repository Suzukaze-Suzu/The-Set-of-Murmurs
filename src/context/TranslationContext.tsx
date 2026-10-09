// ============================================================================
// 呓语集 · 译文上下文（P3，2026-09-21）
// ----------------------------------------------------------------------------
// 公开页只需要**已审校（reviewed）**的译文，而且是一整批：
//   首页/文章列表/分类页/书架都要把标题换成英文，逐篇去问数据库会打几十个请求。
//   所以进站时按 locale 拉一次全量 reviewed 译文，放内存里按 article_id 取。
//
// 两条纪律（别改）：
//   ① **中文线（locale='zh'）一个请求都不发**——中文站要完全不受英文线影响，
//      译文表里全是英文，中文页没有任何理由去读它。
//   ② 表不存在 / 请求失败时静默降级成「没有译文」，页面显示中文原文，
//      英文站照样能开，不会因为一张还没建的表白屏。
//
// ★ 2026-10-09「英文站不依附中文站，先加载英文翻译」：
//   英文线的译文**在挂载 React 之前就已经预载过一轮**（main.tsx + lib/translationPreload.ts），
//   这里同步取那一份当 useState 初值 → 英文页首帧即英文，不再「先中文、后英文」。
//   本文件不再自己发请求，只复用预载的同一个 promise（超时/失败都退化为「显示中文原文」）。
//
// P5（2026-09-21）加的一块：**标签词典**（`tag_translations`）与译文一起拉，
//   一起进 localize——标签是全站共用的，一篇没译的文章照样能显示英文标签。
// ============================================================================

import { createContext, useContext, ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocale } from '../i18n';
import {
  ArticleTranslation,
  LocalizedArticle,
  localizeArticle,
} from '../lib/translations';
import {
  TagMap,
  translateTag,
} from '../lib/tagTranslations';
import { startPreload, takePreloaded } from '../lib/translationPreload';
import type { Article } from '../types';

interface TranslationCtx {
  /** 译文是否已加载完（英文线列表页可用它避免「标题先中文后英文」的跳变） */
  ready: boolean;
  get: (articleId: string) => ArticleTranslation | undefined;
  has: (articleId: string) => boolean;
  /** 把译文套到文章上（缺字段逐项回退中文，标签走全站词典） */
  localize: (article: Article) => LocalizedArticle;
  /** 标签词典（中文标签 → 英文），只有已审校的 */
  tagMap: TagMap;
  /** 换一个标签：词典里没有就原样返回中文 */
  tagOf: (tag: string) => string;
  refresh: () => void;
}

const Ctx = createContext<TranslationCtx | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  /* ★ 2026-10-09「英文站先加载英文翻译」★
     main.tsx 在挂载 React 之前已经预载过一轮（lib/translationPreload.ts），这里同步取那一份当**初值**：
     于是英文页的**首帧就是英文**，不会先渲染中文再跳成英文。
     没预载到（超时/断网/中文线）＝ 保持原来的行为：先空着、拉到了再套上，缺译文的那篇回退中文原文。 */
  const [map, setMap] = useState<Record<string, ArticleTranslation>>(
    () => takePreloaded(locale)?.map ?? {},
  );
  const [tags, setTags] = useState<TagMap>(() => takePreloaded(locale)?.tags ?? {});
  const [ready, setReady] = useState(locale === 'zh' || !!takePreloaded(locale));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // ① 中文线不读译文表，也不读标签词典
    if (locale !== 'en') {
      setMap({});
      setTags({});
      setReady(true);
      return;
    }
    let mounted = true;
    // version > 0 ＝ refresh()：工作台保存译文后要**真的重新拉一次**（不能用预载缓存）
    const force = version > 0;
    // 已经有预载数据时不许再置 ready=false，否则刚拿到的英文又会被打回「未就绪」
    if (force || !takePreloaded(locale)) setReady(false);
    // 与 main.tsx 的预载共用同一个 promise（不重复请求）；这个 promise 不会 reject，
    // 超时也只是「晚一点到位」——所以英文站不会永久卡在加载态，更不会停在中文上
    startPreload(locale, force).then((res) => {
      if (!mounted) return;
      if (res) {
        setMap(res.map);
        setTags(res.tags);
      }
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [locale, version]);

  const value = useMemo<TranslationCtx>(
    () => ({
      ready,
      get: (id) => map[id],
      has: (id) => !!map[id],
      localize: (article) => localizeArticle(article, map[article.id], tags),
      tagMap: tags,
      tagOf: (tag) => translateTag(tag, tags),
      refresh: () => setVersion((v) => v + 1),
    }),
    [map, tags, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTranslations(): TranslationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTranslations must be used within TranslationProvider');
  return ctx;
}

/** 组件里最常用的一步：拿到「渲染用」的文章（英文页自动换成译文） */
export function useLocalizedArticle(article: Article): LocalizedArticle {
  const { localize } = useTranslations();
  return useMemo(() => localize(article), [article, localize]);
}
