import { useMemo, useState } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META } from '../types';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';

interface Props {
  query: string;
}

const PAGE_SIZE = 12;

export default function Articles({ query }: Props) {
  usePageTitle('全部文章');
  const { articles } = useArticles();
  const [catFilter, setCatFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchCat = catFilter === 'all' || a.category === catFilter;
      if (!matchCat) return false;
      if (!query) return true;
      const haystack = (a.title + ' ' + a.content + ' ' + (a.summary || '') + ' ' + a.tags.join(' ')).toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [articles, catFilter, query]);

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
      <h1 className="page-title">全部文章</h1>

      <div className="filter-bar">
        <button className={`filter-chip ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>
          全部
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`filter-chip ${catFilter === c ? 'active' : ''}`}
            onClick={() => setCatFilter(c)}
            style={catFilter === c ? { background: CATEGORY_META[c].color } : {}}
          >
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {query && (
        <p className="result-count">
          搜索 “<strong>{query}</strong>”，共 {total} 篇
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-magnifier" />
          <p>没有找到匹配的文章</p>
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
            <div ref={sentinelRef} className="list-loading">滚动加载更多…</div>
          ) : (
            <p className="list-end">已加载全部 {total} 篇</p>
          )}
        </>
      )}
    </div>
  );
}
