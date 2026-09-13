import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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

const FONT_SIZES = ['1.05rem', '1.2rem', '1.35rem', '1.5rem'];
const LINE_HEIGHTS = ['1.8', '2', '2.2'];

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
  const [barsVisible, setBarsVisible] = useState(true); // 工具条是否显示

  const scrollRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 开始阅读：进入沉浸阅读页
  const startReading = (ix = startIx) => {
    setCurIx(ix);
    saveProgress(ix);
    setView('reader');
    setTocOpen(false);
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  };

  // 返回书头页
  const backToShelf = () => {
    setTocOpen(false);
    setSettingOpen(false);
    setView('shelf');
    setBarsVisible(true);
  };

  // 工具条自动隐藏：滚动时隐藏，鼠标移动/触摸时短暂显示
  const showBars = () => {
    setBarsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!tocOpen && !settingOpen) setBarsVisible(false);
    }, 2600);
  };

  // 点屏幕中间唤出/隐藏工具条
  const toggleBars = () => {
    setBarsVisible((v) => !v);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  // 键盘
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

  // 当前章评论
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
    return null;
  }

  const themeCls = theme === 'night' ? 'novel-reader-night' : '';
  const fullscreenCls = view === 'reader' ? ' nreader-fullscreen' : '';
  const barsCls = barsVisible ? '' : ' nreader-bars-hidden';

  return (
    <div className={'novel-reader ' + themeCls + fullscreenCls}>
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
                <span className="nreader-status-badge" style={{ background: statusMeta.color + '22', color: statusMeta.ink }}>
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
              {readPct > 0 ? '继续阅读 · ' + cur.title : '开始阅读'}
            </button>
            <button className="nreader-toc-btn" onClick={() => setTocOpen(true)}>目录</button>
          </div>

          <details className="nreader-book-comments" open>
            <summary>整本评论（{bookComments.length}）</summary>
            <CommentSection
              comments={bookComments}
              onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id, { name, content, parentId, parentName, avatar })}
              currentUserId={currentUserId}
              onDelete={(id) => onDeleteComment(id)}
            />
          </details>
        </div>
      )}

      {/* ===== 沉浸阅读页（Apple Books 风） ===== */}
      {view === 'reader' && (
        <div
          className={'nreader-page' + barsCls}
          ref={scrollRef}
          onScroll={() => {
            if (barsVisible) {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              hideTimer.current = setTimeout(() => {
                if (!tocOpen && !settingOpen) setBarsVisible(false);
              }, 900);
            }
          }}
          onMouseMove={() => { if (!barsVisible) showBars(); }}
          onClick={(e) => {
            // 点击正文中间唤出/隐藏工具条（忽略点击按钮、链接、评论时）
            const t = e.target as HTMLElement;
            if (t.closest('button, a, .nreader-toc, .nreader-sheet, textarea, input, .comment-section')) return;
            const r = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - r.left;
            const midW = r.width / 3;
            if (mx > midW && mx < r.width - midW) {
              toggleBars();
            }
          }}
        >
          {/* 顶栏 */}
          <div className="nreader-topbar">
            <div className="nreader-top-left">
              <button className="nreader-top-btn back" onClick={backToShelf} title="返回书籍">‹</button>
            </div>
            <button className="nreader-top-title" onClick={() => setTocOpen(true)} title="章节目录">
              {cur.title}
            </button>
            <div className="nreader-top-right">
              <span className="nreader-top-progress">{curIx + 1}/{total}</span>
              <button className="nreader-top-btn" onClick={() => setSettingOpen(true)} title="设置">Aa</button>
            </div>
          </div>

          {/* 正文 */}
          <article
            className="nreader-chapter"
            style={{ fontSize: FONT_SIZES[fontIx], lineHeight: LINE_HEIGHTS[lineIx] }}
          >
            {cur.part && (curIx === 0 || chapters[curIx - 1]?.part !== cur.part) && (
              <h1 className="nreader-part-title"># {cur.part}</h1>
            )}
            <h2 className="nreader-chapter-title">{cur.title}</h2>
            <MarkdownRenderer content={cur.content} />
          </article>

          {/* 底部分页导航 */}
          <div className="nreader-footnav">
            <button
              className="nreader-foot-btn"
              disabled={curIx <= 0}
              onClick={() => goTo(curIx - 1)}
            >
              <span className="nreader-foot-dir">上一章</span>
              <span className="nreader-foot-name">{curIx > 0 ? chapters[curIx - 1].title : ''}</span>
            </button>
            <button className="nreader-foot-btn right" disabled={curIx >= total - 1} onClick={() => goTo(curIx + 1)}>
              <span className="nreader-foot-dir">下一章</span>
              <span className="nreader-foot-name">{curIx < total - 1 ? chapters[curIx + 1].title : ''}</span>
            </button>
          </div>

          <div className="nreader-chapter-comments">
            <h3 className="nreader-comments-ttl">本章评论（{curComments.length}）</h3>
            <CommentSection
              comments={curComments}
              onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id + '::' + cur.id, { name, content, parentId, parentName, avatar })}
              currentUserId={currentUserId}
              onDelete={(id) => onDeleteComment(id)}
            />
          </div>

          {/* 底部整本进度细线 */}
          <div className="nreader-book-progress">
            <div className="nreader-book-progress-fill" style={{ width: readPct + '%' }} />
          </div>
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
              {chapters.map((ch, ix) => {
                const isPartStart = ch.part && (ix === 0 || chapters[ix - 1]?.part !== ch.part);
                return (
                  <Fragment key={ch.id}>
                    {isPartStart && <div className="nreader-toc-part">{ch.part}</div>}
                    <button
                      className={'nreader-toc-item' + (ix === curIx ? ' current' : '')}
                      onClick={() => goTo(ix)}
                    >
                      <span className="nreader-toc-no">{ix + 1}</span>
                      <span className="nreader-toc-name">{ch.title}</span>
                      {ch.wordCount ? <span className="nreader-toc-wc">{ch.wordCount} 字</span> : null}
                    </button>
                  </Fragment>
                );
              })}
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