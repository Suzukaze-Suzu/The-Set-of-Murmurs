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

const FONT_SIZES = ['1rem', '1.15rem', '1.3rem', '1.45rem'];
const LINE_HEIGHTS = ['1.8', '2', '2.3'];

export default function NovelReader({ article, allComments, onAddComment, onDeleteComment, currentUserId }: Props) {
  const novel = article.novel;
  const chapters = useMemo(
    () => (novel?.chapters || []).slice().sort((a, b) => a.order - b.order),
    [novel]
  );

  const progKey = 'novel-progress-' + article.id;
  const [progress, setProgress] = useLocalStorage<{ chapterId?: string }>(progKey, {});

  const [fontIx, setFontIx] = useLocalStorage<number>('novel-font', 1);
  const [lineIx, setLineIx] = useLocalStorage<number>('novel-line', 1);
  const [theme, setTheme] = useLocalStorage<'light' | 'night'>('novel-theme', 'light');

  const [tocOpen, setTocOpen] = useState(false);
  const [settingOpen, setSettingOpen] = useState(false);
  const [view, setView] = useState<'shelf' | 'reader'>('shelf');

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
    setSettingOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 开始阅读：进入沉浸阅读页
  const startReading = (ix = startIx) => {
    setCurIx(ix);
    saveProgress(ix);
    setView('reader');
    setTocOpen(false);
    window.scrollTo({ top: 0 });
  };

  // 返回书头页
  const backToShelf = () => {
    setTocOpen(false);
    setSettingOpen(false);
    setView('shelf');
  };

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') goTo(curIx + 1);
      if (e.key === 'ArrowLeft') goTo(curIx - 1);
      if (e.key === 'Escape') {
        setTocOpen(false);
        setSettingOpen(false);
      }
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

  const themeCls = theme === 'night' ? 'novel-reader-night' : '';

  return (
    <div className={'novel-reader ' + themeCls}>
      {/* ===== 书头详情页 ===== */}
      {view === 'shelf' && (
        <div className="nreader-shelf">
          <div className="nreader-cover-hero">
            {novel?.cover ? (
              <img src={novel.cover} alt={article.title} className="nreader-hero-cover" />
            ) : (
              <div className="nreader-hero-cover nreader-hero-cover-ph">{article.title.slice(0, 1)}</div>
            )}
            <div className="nreader-hero-info">
              <Link to={`/category/${article.category}`} className="nreader-cat">小说</Link>
              <h1 className="nreader-book-title">{article.title}</h1>
              {novel?.author && <div className="nreader-book-author">作者 {novel.author}</div>}
              {statusMeta && (
                <span className="nreader-status-badge" style={{ background: statusMeta.color + '22', color: statusMeta.color }}>
                  {statusMeta.label}
                </span>
              )}
              <div className="nreader-book-meta">
                <span>共 {total} 章</span>
                {novel?.wordCount ? <span>· {novel.wordCount} 字</span> : null}
                {readPct > 0 ? <span>· 已读 {readPct}%</span> : null}
              </div>
            </div>
          </div>

          {novel?.synopsis && <p className="nreader-synopsis">{novel.synopsis}</p>}

          <div className="nreader-shelf-actions">
            <button className="nreader-start-btn" onClick={() => startReading(startIx)}>
              <span className="nreader-start-ico">▶</span>
              {readPct > 0 ? `继续阅读 · 第${curIx + 1}章` : '开始阅读'}
            </button>
            <button className="nreader-toc-btn" onClick={() => setTocOpen(true)}>目录</button>
          </div>

          {bookComments.length > 0 && (
            <details className="nreader-book-comments" open>
              <summary>整本评论（{bookComments.length}）</summary>
              <CommentSection
                comments={bookComments}
                onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id, { name, content, parentId, parentName, avatar })}
                currentUserId={currentUserId}
                onDelete={(id) => onDeleteComment(id)}
              />
            </details>
          )}
        </div>
      )}

      {/* ===== 沉浸阅读页 ===== */}
      {view === 'reader' && (
        <div className="nreader-page">
          <div className="nreader-topbar">
            <div className="nreader-top-left">
              <button className="nreader-top-btn back" onClick={backToShelf}>‹ 返回书籍</button>
              <span className="nreader-top-title">{article.title}</span>
            </div>
            <div className="nreader-top-right">
              <span className="nreader-top-progress">{curIx + 1}/{total}</span>
              <button className="nreader-top-btn" onClick={() => setTocOpen(true)}>目录</button>
              <button className="nreader-top-btn" onClick={() => setSettingOpen(true)}>Aa</button>
            </div>
          </div>

          <div className="nreader-progressbar">
            <div className="nreader-progress-fill" style={{ width: readPct + '%' }} />
          </div>

          <article
            className="nreader-chapter"
            style={{ fontSize: FONT_SIZES[fontIx], lineHeight: LINE_HEIGHTS[lineIx] }}
          >
            <h2 className="nreader-chapter-title">{cur.title}</h2>
            <MarkdownRenderer content={cur.content} />
          </article>

          <div className="nreader-footnav">
            <button
              className="nreader-foot-btn"
              disabled={curIx <= 0}
              onClick={() => goTo(curIx - 1)}
            >
              <span className="nreader-foot-dir">← 上一章</span>
              <span className="nreader-foot-name">{curIx > 0 ? chapters[curIx - 1].title : ''}</span>
            </button>
            <button className="nreader-foot-btn foot-center" onClick={() => setTocOpen(true)}>目录</button>
            <button
              className="nreader-foot-btn right"
              disabled={curIx >= total - 1}
              onClick={() => goTo(curIx + 1)}
            >
              <span className="nreader-foot-dir">下一章 →</span>
              <span className="nreader-foot-name">{curIx < total - 1 ? chapters[curIx + 1].title : ''}</span>
            </button>
          </div>

          {curComments.length > 0 && (
            <div className="nreader-chapter-comments">
              <h3 className="nreader-comments-ttl">本章评论（{curComments.length}）</h3>
              <CommentSection
                comments={curComments}
                onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id + '::' + cur.id, { name, content, parentId, parentName, avatar })}
                currentUserId={currentUserId}
                onDelete={(id) => onDeleteComment(id)}
              />
            </div>
          )}
        </div>
      )}

      {/* ===== 目录抽屉 ===== */}
      {tocOpen && (
        <div className="nreader-toc-mask" onClick={() => setTocOpen(false)}>
          <div className="nreader-toc" onClick={(e) => e.stopPropagation()}>
            <div className="nreader-toc-head">
              <span>章节目录</span>
              <button className="nreader-top-btn" onClick={() => setTocOpen(false)}>✕</button>
            </div>
            <div className="nreader-toc-list">
              {chapters.map((ch, ix) => (
                <button
                  key={ch.id}
                  className={'nreader-toc-item' + (ix === curIx ? ' current' : '')}
                  onClick={() => goTo(ix)}
                >
                  <span className="nreader-toc-no">{ix + 1}</span>
                  <span className="nreader-toc-name">{ch.title}</span>
                  {ch.wordCount ? <span className="nreader-toc-wc">{ch.wordCount} 字</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 设置底部面板 ===== */}
      {settingOpen && (
        <div className="nreader-set-mask" onClick={() => setSettingOpen(false)}>
          <div className="nreader-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="nreader-sheet-grip" />
            <div className="nreader-sheet-row">
              <span className="nreader-sheet-label">夜间模式</span>
              <button
                className={'nreader-pill' + (theme === 'night' ? ' on' : '')}
                onClick={() => setTheme(theme === 'night' ? 'light' : 'night')}
              >
                {theme === 'night' ? '已开启' : '开启'}
              </button>
            </div>
            <div className="nreader-sheet-row">
              <span className="nreader-sheet-label">字号</span>
              <div className="nreader-sheet-group">
                <button className="nreader-pill" onClick={() => setFontIx(Math.max(0, fontIx - 1))}>A−</button>
                <span className="nreader-size-val">{['小','中','大','特大'][fontIx]}</span>
                <button className="nreader-pill" onClick={() => setFontIx(Math.min(FONT_SIZES.length - 1, fontIx + 1))}>A＋</button>
              </div>
            </div>
            <div className="nreader-sheet-row">
              <span className="nreader-sheet-label">行距</span>
              <div className="nreader-sheet-group">
                <button className="nreader-pill" onClick={() => setLineIx(Math.max(0, lineIx - 1))}>紧凑</button>
                <span className="nreader-size-val">适中</span>
                <button className="nreader-pill" onClick={() => setLineIx(Math.min(LINE_HEIGHTS.length - 1, lineIx + 1))}>宽松</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}