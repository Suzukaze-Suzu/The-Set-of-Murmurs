import { useParams, Link } from 'react-router-dom';
import { useMemo, useEffect } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORY_META, Category } from '../types';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';

const PAGE_SIZE = 12;

export default function SectionPage() {
  const { category } = useParams();
  const { articles } = useArticles();
  const { isAdmin } = useAuth();

  const cat = (category as Category) in CATEGORY_META ? (category as Category) : 'anime';
  const meta = CATEGORY_META[cat];
  usePageTitle(meta.label);

  const list = useMemo(
    () => articles.filter((a) => a.category === cat).sort((a, b) => b.date.localeCompare(a.date)),
    [articles, cat]
  );

  const { visible, hasMore, total, sentinelRef } = useInfiniteList(list, PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category]);

  return (
    <div className="page">
      <div className="cat-header" style={{ background: `linear-gradient(135deg, ${meta.color}1f, #ffffff 72%)`, borderLeft: `4px solid ${meta.ink}` }}>
        <Link to="/articles" className="back-link">‹ 全部文章</Link>
        <h1 className="page-title light">
          {meta.label}
        </h1>
        <p className="cat-count">共 {list.length} 篇</p>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-ghost" />
          <p>这个分类还没有文章</p>
          {isAdmin && <Link to="/write" className="btn btn-primary">去写一篇</Link>}
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
