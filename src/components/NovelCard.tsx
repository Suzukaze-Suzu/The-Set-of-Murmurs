import { Link } from 'react-router-dom';
import { Article } from '../types';
import { NOVEL_STATUS_META } from '../types';

interface Props {
  article: Article;
}

export default function NovelCard({ article }: Props) {
  const novel = article.novel;
  const chapters = (novel?.chapters || []).slice().sort((a, b) => a.order - b.order);
  const status = novel?.status;
  const statusMeta = status ? NOVEL_STATUS_META[status] : null;

  return (
    <div className="novel-card">
      {novel?.cover ? (
        <div className="novel-cover-wrap">
          <img src={novel.cover} alt={article.title} className="novel-cover" />
        </div>
      ) : (
        <div className="novel-cover novel-cover-placeholder">
          <span className="novel-cover-char">{article.title.slice(0, 1)}</span>
        </div>
      )}

      <div className="novel-card-body">
        <Link to={`/article/${article.id}`} className="novel-title">{article.title}</Link>
        {novel?.author && <div className="novel-author">作者：{novel.author}</div>}

        {statusMeta && (
          <span className="novel-status-badge" style={{ background: statusMeta.color + '22', color: statusMeta.color }}>
            {statusMeta.label}
          </span>
        )}

        {novel?.synopsis && <p className="novel-synopsis">{novel.synopsis}</p>}

        <div className="novel-stats">
          <span>共 {chapters.length} 章</span>
          <span>·</span>
          <span>{novel?.wordCount ? `${novel.wordCount} 字` : ''}</span>
        </div>

        <Link to={`/article/${article.id}`} className="read-more">开始阅读</Link>
      </div>
    </div>
  );
}