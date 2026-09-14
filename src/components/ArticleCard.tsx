import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
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
        {/* 第2g步：分类小签的底色＝该分类的色卡色实底（亮色），字色由 --cat-on 给；
            暗色由 index.css 的还原块改回「13% 淡底 + 同色系墨色字」。 */}
        <span className="card-cat" style={{ '--cat-color': meta.color, '--cat-ink': meta.ink, '--cat-on': meta.onFill } as CSSProperties}>
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

