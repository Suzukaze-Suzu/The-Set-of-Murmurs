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
// P5（2026-09-21）加的一块：**标签词典**（`tag_translations`）与译文一起拉，
//   一起进 localize——标签是全站共用的，一篇没译的文章照样能显示英文标签。
// ============================================================================

import { createContext, useContext, ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocale } from '../i18n';
import {
  ArticleTranslation,
  LocalizedArticle,
  fetchReviewedTranslations,
  localizeArticle,
} from '../lib/translations';
import {
  TagMap,
  fetchReviewedTagTranslations,
  translateTag,
} from '../lib/tagTranslations';
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
  const [map, setMap] = useState<Record<string, ArticleTranslation>>({});
  const [tags, setTags] = useState<TagMap>({});
  const [ready, setReady] = useState(locale === 'zh');
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
    setReady(false);
    // 译文与标签词典各拉一次（两条请求并发，别串起来等）
    Promise.all([fetchReviewedTranslations('en'), fetchReviewedTagTranslations('en')]).then(
      ([list, tagMap]) => {
        if (!mounted) return;
        const next: Record<string, ArticleTranslation> = {};
        for (const tr of list) next[tr.articleId] = tr;
        setMap(next);
        setTags(tagMap);
        setReady(true);
      },
    );
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
