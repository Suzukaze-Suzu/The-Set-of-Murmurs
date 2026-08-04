import { useParams, Link } from 'react-router-dom';
import { useArticles } from '../context/ArticleContext';
import { CATEGORY_META, Category } from '../types';
import ArticleCard from '../components/ArticleCard';
import { useEffect } from 'react';

export default function SectionPage() {
  const { category } = useParams();
  const { getByCategory } = useArticles();

  const cat = (category as Category) in CATEGORY_META ? (category as Category) : 'anime';
  const meta = CATEGORY_META[cat];
  const list = getByCategory(cat);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category]);

  return (
    <div className="page">
      <div className="cat-header" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)` }}>
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
          <Link to="/write" className="btn btn-primary">去写一篇</Link>
        </div>
      ) : (
        <div className="card-grid wide">
          {list.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
