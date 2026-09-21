import { useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META } from '../types';
import type { Article } from '../types';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { searchArticles } from '../lib/search';
import { useT } from '../i18n';
import { catKey } from '../i18n/dict';

interface Props {
  query: string;
}

const PAGE_SIZE = 12;

export default function Articles({ query }: Props) {
  const t = useT();
  usePageTitle(t('article.all'));
  const { articles } = useArticles();
  const [catFilter, setCatFilter] = useState<string>('all');

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
      searchArticles(q).then((res) => {
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

  return (
    <div className="page">
      <h1 className="page-title">{t('article.all')}</h1>

      <div className="filter-bar">
        <button className={`filter-chip ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>
          {t('article.filterAll')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`filter-chip ${catFilter === c ? 'active' : ''}`}
            onClick={() => setCatFilter(c)}
            /* 第2g步：激活态＝该分类色卡色实底（亮色），字色走 --cat-on；暗色见 index.css 还原块 */
            style={catFilter === c ? ({ '--cat-color': CATEGORY_META[c].color, '--cat-ink': CATEGORY_META[c].ink, '--cat-on': CATEGORY_META[c].onFill } as CSSProperties) : {}}
          >
            {t(catKey(c))}
          </button>
        ))}
      </div>

      {query && (
        <p className="result-count">
          {t('search.prefix')}<strong>{query}</strong>
          {searching ? t('search.suffixIng') : t('search.suffix', { n: total })}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-magnifier" />
          <p>{searching ? t('search.searching') : t('search.noMatch')}</p>
        </div>
      ) : (
        <>
          <div className="card-grid wide">
            {visible.map((a) =>
              a.novel?.chapters?.length ? (
                <NovelCard key={a.id} article={a} />
              ) : (
                <ArticleCard key={a.id} article={a} />
              )
            )}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="list-loading">{t('count.loadingMore')}</div>
          ) : (
            <p className="list-end">{t('count.allLoaded', { n: total })}</p>
          )}
        </>
      )}
    </div>
  );
}
