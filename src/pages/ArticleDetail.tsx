import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useComments } from '../context/CommentContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_META } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import CommentSection from '../components/CommentSection';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { getById, toggleFavorite, deleteArticle } = useArticles();
  const { articleComments, addArticleComment, deleteComment } = useComments();

  const article = getById(id || '');
  const comments = articleComments.filter((c) => c.articleId === id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!article) {
    return (
      <div className="page empty-state">
        <span className="empty-icon empty-icon-ghost" />
        <p>文章不存在或被删除了</p>
        <Link to="/" className="btn btn-primary">返回首页</Link>
      </div>
    );
  }

  const meta = CATEGORY_META[article.category];

  // 导出为 .md 文件
  const exportMarkdown = () => {
    const header = `# ${article.title}\n\n> ${article.summary || ''}\n\n**日期：** ${article.date}\n**分类：** ${meta.label}\n**标签：** ${article.tags.join(', ')}\n\n---\n\n`;
    const content = header + article.content;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const afterDelete = () => {
    deleteArticle(article.id);
    navigate('/articles');
  };

  return (
    <div className="page article-detail">
      <div className="detail-head">
        <div className="detail-cats">
          <Link to={`/category/${article.category}`} className="detail-cat" style={{ background: meta.color + '22', color: meta.color }}>
            {meta.label}
          </Link>
          {article.tags.map((t) => (
            <span key={t} className="detail-tag">#{t}</span>
          ))}
        </div>
        <h1 className="detail-title">{article.title}</h1>
        <div className="detail-meta">
          <span className="detail-meta-icon">▪</span>
          <span>{article.date}</span>
          {isAdmin && (
          <button className={`meta-btn ${article.favorite ? 'meta-fav-on' : ''}`} onClick={() => toggleFavorite(article.id)}>
            {article.favorite ? '★ 已收藏' : '☆ 收藏'}
          </button>
          )}
          {isAdmin && (
          <button className="meta-btn" onClick={exportMarkdown}>
            导出 .md
          </button>
          )}
      </div>
      </div>

      <article className="detail-body card">
        <MarkdownRenderer content={article.content} />
      </article>

      {isAdmin && (
        <div className="detail-actions">
          <button className="btn btn-danger" onClick={afterDelete}>删除文章</button>
    </div>
      )}

      <CommentSection comments={comments} onAdd={(name, content, parentId, parentName, avatar) => addArticleComment(article.id, { name, content, parentId, parentName, avatar })} currentUserId={user?.id} onDelete={(cid) => deleteComment(cid, 'comment')} />
    </div>
  );
}

