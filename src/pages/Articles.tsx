import { useMemo, useState } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META } from '../types';
import ArticleCard from '../components/ArticleCard';

interface Props {
  query: string;
}

export default function Articles({ query }: Props) {
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

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

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
          搜索 “<strong>{query}</strong>”，共 {sorted.length} 篇
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-magnifier" />
          <p>没有找到匹配的文章</p>
        </div>
      ) : (
        <div className="card-grid wide">
          {sorted.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
