import { useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META } from '../types';
import type { Article } from '../types';
import N1Entry from '../components/n1/N1Entry';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { searchArticles } from '../lib/search';
import { useT, useLocale } from '../i18n';
import { catKey } from '../i18n/dict';

interface Props {
  query: string;
}

const PAGE_SIZE = 12;

/* ══════════════════════════════════════════════════════════════════════════════
   文章档案页（2026-10-09 迁入 N1）
   ──────────────────────────────────────────────────────────────────────────────
   用户原话：「修改文章界面以及具体阅读界面，设计为与其他页面类似风格」，并裁决：
     · 范围＝三页一起做（本页 ＋ /category/:c ＋ /article/:id）
     · 条目形态＝**三栏纯文字流 `.list`/`.item`**（＝样张首页右栏、书架「同分类文章」同款）
     · 搜索＝**在页头上加 N1 风格搜索行**（旧顶栏那枚放大镜随旧外壳一起退场，搜索不能因此进不去）
   样张没有画档案页，所以整页只用样张已有的零件拼：
     `.pagehead`(.pagehead-txt/.kicker/h1/.lede) ＋ 搜索行（样张外，落 `n1-app.css`）
     ＋ 分类索引带 `.tiles`/`.tile`（照 index.html 545-550 的分类浏览带，改成可点的 `<button>`）
     ＋ 列表 `.list` 三栏流 ＋ 页尾加载小注。
   **逻辑一行没动**：分类筛选、数据库全文搜索（300ms 防抖）、无命中提示、置顶优先＋日期倒序、
   无限滚动（PAGE_SIZE=12）、i18n。版式层之外的旧外壳由 `lib/n1Routes.ts` 换成 N1Shell。
   ⚠️ 本页**不传收藏回调**（与改版前逐字一致：列表上的 ☆ 点了没有反应，是既有语义坑，照原样迁）。
   回退＝`git checkout -- src/pages/Articles.tsx` ＋ 从 `n1Routes.ts` 删掉 `/articles` 一条。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function Articles({ query: initialQuery }: Props) {
  const t = useT();
  const { locale } = useLocale();
  usePageTitle(t('article.all'));
  const { articles } = useArticles();
  const [catFilter, setCatFilter] = useState<string>('all');

  /* N1 报头里没有搜索框，搜索词由本页自己持有（初值仍取旧外壳传下来的 query，
     这样万一将来两种外壳并存也不会丢词）。 */
  const [query, setQuery] = useState(initialQuery);

  // 数据库全文搜索：300ms 防抖，结果单独存放，不污染全量列表
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchArticles(q, locale).then((res) => {
        if (!cancelled) {
          setSearchResults(res);
          setSearching(false);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // 有搜索词时用数据库结果，否则用全量文章
  const base = searchResults !== null ? searchResults : articles;

  const filtered = useMemo(() => {
    return base.filter((a) => catFilter === 'all' || a.category === catFilter);
  }, [base, catFilter]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.date.localeCompare(a.date);
      }),
    [filtered]
  );

  const { visible, hasMore, total, sentinelRef } = useInfiniteList(sorted, PAGE_SIZE);

  /* 分类索引带右端那枚数字＝**全站该分类的篇数**（照样张 index.html 的分类浏览带口径，
     不跟着搜索词变——搜索只影响下面那条流）。 */
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    articles.forEach((a) => { m[a.category] = (m[a.category] || 0) + 1; });
    return m;
  }, [articles]);

  return (
    <>
      {/* 页头：照样张 guestbook.html / novel.html 的 .pagehead（上方 4px 实线、下方 3px 双线、居中） */}
      <section className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">THE ARCHIVE</div>
          <h1>{t('article.all')}</h1>
          <p className="lede">{t('count.posts', { n: articles.length })}</p>
        </div>
      </section>

      {/* 搜索行 ＋ 分类索引带 */}
      <section className="sec">
        <div className="arch-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nav.searchPlaceholder')}
            aria-label={t('nav.search')}
          />
          <span className="arch-note">
            {searching ? t('search.searching') : t('count.posts', { n: total })}
          </span>
        </div>

        <div className="tiles">
          <button
            type="button"
            className={`tile${catFilter === 'all' ? ' on' : ''}`}
            onClick={() => setCatFilter('all')}
          >
            <b>{t('article.filterAll')}</b>
            <span className="n">{articles.length}</span>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`tile${catFilter === c ? ' on' : ''}`}
              /* 分类色照旧由 CATEGORY_META 给（色卡色，一个字没换），只当名字前那枚小方块 */
              style={{ '--c': CATEGORY_META[c].color } as CSSProperties}
              onClick={() => setCatFilter(c)}
            >
              <b>{t(catKey(c))}</b>
              <span className="n">{catCounts[c] || 0}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 列表：三栏纯文字流 */}
      <section className="sec">
        {sorted.length === 0 ? (
          <p className="gnote">{searching ? t('search.searching') : t('search.noMatch')}</p>
        ) : (
          <>
            <div className="list list-archive">
              {visible.map((a) => (
                <N1Entry key={a.id} article={a} />
              ))}
            </div>
            {hasMore ? (
              <div ref={sentinelRef} className="gnote list-loading">{t('count.loadingMore')}</div>
            ) : (
              <p className="gnote list-end">{t('count.allLoaded', { n: total })}</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
