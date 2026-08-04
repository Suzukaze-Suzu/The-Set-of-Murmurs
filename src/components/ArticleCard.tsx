import { Link } from 'react-router-dom';
import { Article, CATEGORY_META } from '../types';
import { useAuth } from '../context/AuthContext';

interface Props {
  article: Article;
  onToggleFavorite?: (id: string) => void;
}

export default function ArticleCard({ article, onToggleFavorite }: Props) {
  const { isAdmin } = useAuth();
  const meta = CATEGORY_META[article.category];
  return (
    <div
      className="article-card"
      style={{ borderTop: `4px solid ${meta.color}` }}
    >
      <div className="card-top">
        <span className="card-cat" style={{ background: meta.color + '22', color: meta.color }}>
          {meta.label}
        </span>
        <div className="card-actions">
          {article.pinned && <span className="card-pin" title="置顶">置顶</span>}
          {isAdmin ? (
            <button
            className={`fav-btn ${article.favorite ? 'fav-on' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite?.(article.id);
            }}
            title={article.favorite ? '取消收藏' : '收藏'}
          >
            {article.favorite ? '★' : '☆'}
          </button>
          ) : article.favorite ? (
            <span className="fav-btn fav-on" title="收藏">★</span>
          ) : null}
        </div>
      </div>

      <Link to={`/article/${article.id}`} className="card-title">
        {article.title}
      </Link>

      {article.summary && <p className="card-summary">{article.summary}</p>}

      <div className="card-tags">
        {article.tags.map((t) => (
          <span key={t} className="tag">#{t}</span>
        ))}
      </div>

      <div className="card-foot">
        <span className="card-date">{article.date}</span>
        <Link to={`/article/${article.id}`} className="read-more">阅读</Link>
      </div>
    </div>
  );
}

