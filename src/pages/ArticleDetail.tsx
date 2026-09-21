import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useComments } from '../context/CommentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/TranslationContext';
import { CATEGORY_META } from '../types';
import MarkdownRenderer, { Heading } from '../components/MarkdownRenderer';
import CommentSection from '../components/CommentSection';
import NovelReader from '../components/NovelReader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale } from '../i18n';
import { catKey } from '../i18n/dict';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { getById, toggleFavorite, deleteArticle } = useArticles();
  const { articleComments, addArticleComment, deleteComment } = useComments();
  const { localize } = useTranslations();
  const { locale } = useLocale();
  const t = useT();

  // 英文页：把已审校的译文套到中文原文上（缺译的字段逐项回退中文，见 lib/translations.ts）
  const rawArticle = getById(id || '');
  const localized = useMemo(
    () => (rawArticle ? localize(rawArticle) : null),
    [rawArticle, localize],
  );
  const article = localized?.article;

  usePageTitle(article?.title);

  // 文章目录：MarkdownRenderer 渲染后回调标题列表
  const [headings, setHeadings] = useState<Heading[]>([]);
  const handleHeadings = useCallback((hs: Heading[]) => setHeadings(hs), []);
  const comments = articleComments.filter((c) => c.articleId === id || (id ? c.articleId.startsWith(id + '::') : false));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!article) {
    return (
      <div className="page empty-state">
        <span className="empty-icon empty-icon-ghost" />
        <p>{t('article.notFound')}</p>
        <Link to="/" className="btn btn-primary">{t('article.backHome')}</Link>
      </div>
    );
  }

  const meta = CATEGORY_META[article.category];

  const isNovel = article.category === 'reading' && !!(article.novel?.chapters?.length);

  // 导出为 .md 文件
  const exportMarkdown = () => {
    const header = `# ${article.title}\n\n> ${article.summary || ''}\n\n**${t('article.mdDate')}** ${article.date}\n**${t('article.mdCategory')}** ${t(catKey(article.category))}\n**${t('article.mdTags')}** ${article.tags.join(', ')}\n\n---\n\n`;
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
    if (!window.confirm('确定要删除这篇文章吗？删除后无法恢复。')) return;
    const confirmed = window.confirm('再次确认：真的要删除「' + article.title + '」吗？');
    if (!confirmed) return;
    deleteArticle(article.id);
    navigate('/articles');
  };

  return (
    <div className="page article-detail">
      <div className="detail-head">
        <div className="detail-cats">
          {/* 第2g步：分类小签＝该分类色卡色实底（亮色），字色由 --cat-on 给；暗色见 index.css 还原块 */}
          <Link to={`/category/${article.category}`} className="detail-cat" style={{ '--cat-color': meta.color, '--cat-ink': meta.ink, '--cat-on': meta.onFill } as CSSProperties}>
            {t(catKey(article.category))}
          </Link>
          {article.tags.map((tag) => (
            <span key={tag} className="detail-tag">#{tag}</span>
          ))}
        </div>
        <h1 className="detail-title">{article.title}</h1>
        <div className="detail-meta">
          <span className="detail-meta-icon">▪</span>
          <span>{article.date}</span>
          {isAdmin && (
          <button className={`meta-btn ${article.favorite ? 'meta-fav-on' : ''}`} onClick={() => toggleFavorite(article.id)}>
            {article.favorite ? t('article.savedStar') : t('article.saveStar')}
          </button>
          )}
          {isAdmin && (
          <button className="meta-btn" onClick={exportMarkdown}>
            {t('article.exportMd')}
          </button>
          )}
      </div>
      </div>

      {/* 英文页的缺译提示（P3）：整篇没英文＝一行提示；小说只有部分章节有英文＝另一行 */}
      {locale === 'en' && localized && !localized.translated && (
        <p className="detail-i18n-notice">{t('article.zhOnly')}</p>
      )}
      {locale === 'en' && localized?.translated && localized.chapterFallback && (
        <p className="detail-i18n-notice">{t('article.partialZh')}</p>
      )}

      {isNovel ? (
        <NovelReader
          article={article}
          allComments={comments}
          onAddComment={(articleId, input) => addArticleComment(articleId, input)}
          onDeleteComment={(cid) => deleteComment(cid, 'comment')}
          currentUserId={user?.id}
        />
      ) : (
        <>
          {headings.length > 1 && (
            <details className="toc card">
              <summary className="toc-toggle">{t('article.contents')}</summary>
              <nav className="toc-list">
                {headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className={`toc-link toc-lv${h.level}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </details>
          )}
          <article className="detail-body card">
            <MarkdownRenderer content={article.content} onHeadings={handleHeadings} />
          </article>
        </>
      )}

      {article.attachments && article.attachments.length > 0 && (
      <div className="detail-attachments card">
        <h3 className="detail-att-ttl">{t('article.attachments', { n: article.attachments.length })}</h3>
        <div className="detail-att-list">
          {article.attachments.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noreferrer" className="detail-att-item">
              <span className="detail-att-icon">📎</span>
              <span className="detail-att-name">{att.name}</span>
              {att.size ? <span className="detail-att-size">{(att.size/1024).toFixed(1)} KB</span> : null}
            </a>
          ))}
        </div>
      </div>
      )}

      {isAdmin && (
        <div className="detail-actions">
          <Link to={`/write/${article.id}`} className="btn btn-primary">编辑文章</Link>
          <button className="btn btn-danger" onClick={afterDelete}>删除文章</button>
    </div>
      )}

      {!isNovel && (
      <CommentSection comments={comments} onAdd={(name, content, parentId, parentName, avatar) => addArticleComment(article.id, { name, content, parentId, parentName, avatar })} currentUserId={user?.id} onDelete={(cid) => deleteComment(cid, 'comment')} />
      )}
    </div>
  );
}

