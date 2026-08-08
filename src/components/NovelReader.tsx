import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Article, Comment, NOVEL_STATUS_META } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import MarkdownRenderer from './MarkdownRenderer';
import CommentSection from './CommentSection';

interface Props {
  article: Article;
  allComments: Comment[];
  onAddComment: (articleId: string, input: { name: string; content: string; parentId?: string; parentName?: string; avatar?: string }) => void;
  onDeleteComment: (id: string) => void;
  currentUserId?: string;
}

const FONT_SIZES = ['1rem', '1.15rem', '1.3rem'];

export default function NovelReader({ article, allComments, onAddComment, onDeleteComment, currentUserId }: Props) {
  const novel = article.novel;
  const chapters = useMemo(
    () => (novel?.chapters || []).slice().sort((a, b) => a.order - b.order),
    [novel]
  );

  const progKey = 'novel-progress-' + article.id;
  const [progress, setProgress] = useLocalStorage<{ chapterId?: string }>(progKey, {});

  const [fontIx, setFontIx] = useLocalStorage<number>('novel-font', 1);
  const [theme, setTheme] = useLocalStorage<'light' | 'sepia' | 'night'>('novel-theme', 'light');

  const [tocOpen, setTocOpen] = useState(false);

  const startIx = Math.max(0, chapters.findIndex((ch) => ch.id === progress.chapterId));
  const [curIx, setCurIx] = useState(Math.min(startIx, Math.max(0, chapters.length - 1)));

  const cur = chapters[curIx];
  const total = chapters.length;
  const statusMeta = novel?.status ? NOVEL_STATUS_META[novel.status] : null;
  const readPct = total > 0 ? Math.round(((curIx + 1) / total) * 100) : 0;

  const saveProgress = (ix: number) => {
    const ch = chapters[ix];
    if (ch) setProgress({ chapterId: ch.id });
  };

  // 保存进度并跳转
  const goTo = (ix: number) => {
    const next = Math.max(0, Math.min(total - 1, ix));
    setCurIx(next);
    saveProgress(next);
    setTocOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(curIx + 1);
      if (e.key === 'ArrowLeft') goTo(curIx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIx, total]);

  // 当前章评论：article.id::chapterId
  const curComments = useMemo(
    () => cur ? allComments.filter((c) => c.articleId === article.id + '::' + cur.id) : [],
    [allComments, article.id, cur]
  );
  // 整本评论
  const bookComments = useMemo(
    () => allComments.filter((c) => c.articleId === article.id),
    [allComments, article.id]
  );

  if (total === 0) {
    return null; // 无章节时回到普通渲染（由外层判断 handle）
  }

  const themeCls = theme === 'night' ? 'novel-reader-night' : theme === 'sepia' ? 'novel-reader-sepia' : '';

  return (
    <div className={'novel-reader ' + themeCls}>
      {/* 顶栏 */}
      <div className="novel-topbar">
        <div className="novel-top-left">
          <button className="novel-btn" onClick={() => setTocOpen(true)}>☰ 目录</button>
          <span className="novel-progress">{curIx + 1}/{total} · {readPct}%</span>
        </div>
        <div className="novel-top-right">
          <span className="novel-theme-label">主题</span>
          <button className={'novel-btn' + (theme === 'light' ? ' on' : '')} onClick={() => setTheme('light')}>日</button>
          <button className={'novel-btn' + (theme === 'sepia' ? ' on' : '')} onClick={() => setTheme('sepia')}>护眼</button>
          <button className={'novel-btn' + (theme === 'night' ? ' on' : '')} onClick={() => setTheme('night')}>夜</button>
          <span className="novel-theme-label">字号</span>
          <button className="novel-btn" onClick={() => setFontIx((fontIx + 2) % 3)}>A</button>
          <button className="novel-btn" onClick={() => setFontIx((fontIx + 1) % 3)}>A+</button>
        </div>
      </div>

      {/* 书头 */}
      <div className="novel-bookhead">
        {novel?.cover ? (
          <img src={novel.cover} alt={article.title} className="novel-head-cover" />
        ) : (
          <div className="novel-head-cover novel-head-cover-ph">{article.title.slice(0, 1)}</div>
        )}
        <div className="novel-head-info">
          <Link to={`/category/${article.category}`} className="novel-cat">小说</Link>
          <h1 className="novel-book-title">{article.title}</h1>
          {novel?.author && <div className="novel-book-author">作者：{novel.author}</div>}
          {statusMeta && (
            <span className="novel-status-badge" style={{ background: statusMeta.color + '22', color: statusMeta.color }}>
              {statusMeta.label}
            </span>
          )}
          {novel?.synopsis && <p className="novel-book-synopsis">{novel.synopsis}</p>}
          <div className="novel-book-meta">
            <span>共 {total} 章</span>
            {novel?.wordCount ? <span> · {novel.wordCount} 字</span> : null}
            <span> · 阅读进度 {readPct}%</span>
          </div>
        </div>
      </div>

      {/* 章节正文 */}
      <article className="novel-chapter card" style={{ fontSize: FONT_SIZES[fontIx], lineHeight: 2 }}>
        <h2 className="novel-chapter-title">{cur.title}</h2>
        <MarkdownRenderer content={cur.content} />
      </article>

      {/* 翻页 */}
      <div className="novel-nav">
        <button className="btn btn-light" disabled={curIx <= 0} onClick={() => goTo(curIx - 1)}>← 上一章</button>
        <span className="novel-nav-hint">键盘 ← → 也可翻页</span>
        <button className="btn btn-primary" disabled={curIx >= total - 1} onClick={() => goTo(curIx + 1)}>下一章 →</button>
      </div>

      {/* 本章评论 */}
      <CommentSection
        comments={curComments}
        onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id + '::' + cur.id, { name, content, parentId, parentName, avatar })}
        currentUserId={currentUserId}
        onDelete={(id) => onDeleteComment(id)}
      />

      {/* 整本评论 */}
      <CommentSection
        comments={bookComments}
        onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id, { name, content, parentId, parentName, avatar })}
        currentUserId={currentUserId}
        onDelete={(id) => onDeleteComment(id)}
      />

      {/* 目录抽屉 */}
      {tocOpen && (
        <div className="novel-toc-mask" onClick={() => setTocOpen(false)}>
          <div className="novel-toc" onClick={(e) => e.stopPropagation()}>
            <div className="novel-toc-head">
              <span>章节目录</span>
              <button className="novel-btn" onClick={() => setTocOpen(false)}>✕</button>
            </div>
            <div className="novel-toc-list">
              {chapters.map((ch, ix) => (
                <button
                  key={ch.id}
                  className={'novel-toc-item' + (ix === curIx ? ' current' : '')}
                  onClick={() => goTo(ix)}
                >
                  <span>{ch.title}</span>
                  {ch.wordCount ? <span className="novel-toc-wc">{ch.wordCount} 字</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}