import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useComments } from '../context/CommentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/TranslationContext';
import { CATEGORY_META } from '../types';
import NovelReader from '../components/NovelReader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useT, useLocale } from '../i18n';
import { isNovelArticle, novelHref } from '../lib/novelPath';
import { n1TitleClass } from '../lib/n1TitleSize';
import { formatCountLabel, formatCount } from '../lib/wordCount';

/* ══════════════════════════════════════════════════════════════════════════════
   小说阅读界面·独立一页（2026-10-09 第二轮）
   ──────────────────────────────────────────────────────────────────────────────
   用户原话：**「阅读的时候把文字单独开一个界面，就像之前的阅读器一样，但是要统一风格」**
   选项点名：形态＝**单独一页** `/novels/<书id>/read?ch=<章id>`；
             里面＝本章正文 ＋ 章目录 ＋ 字号/行距/深浅 ＋ 本章评论（**不勾进度**）；
             书介页＝书讯 ＋ 目录 ＋ 设置 ＋ 评论留在 `/novels/<书id>`，目录每条改指本页。

   与旧的全屏沉浸阅读器（`.nreader-fullscreen`，已撤）的差别：**不再铺满视口、不再自带工具条**，
   报头报尾与其余页面同一套 N1 外壳，正文照样张 `.prose`（单栏、占满整幅）——
   「统一风格」指的就是这个：借用样张既有语汇，不发明新控件、不加新色号。

   本页持有的状态（**地址即真值**，与「切到哪章就算读到那章」的既有口径一致）：
     · 当前章 ＝ 地址里的 `?ch=`（认章 id，也认 1 起的章序号）；
       没带 `?ch=` 时退到 localStorage `novel-progress-<书id>`，再退到第 1 章；
     · 翻章（目录点选／上一章／下一章／←→ 键）＝ 存进度 ＋ `?ch=` replace 同步地址 ＋ 滚到正文；
     · 由此**复制出去的地址就是当前章**，浏览器后退键也正常。

   书介页 `/novels/<id>` 上残留的旧地址 `/novels/<id>?ch=<章id>` 会由那边做一次 replace 重定向到本页。
   回退＝删本文件 ＋ `App.tsx` 里 `/novels/:id/read` 那一行（NovelReader 与书介页那半边保留）。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function NovelRead() {
  const { id } = useParams();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const { getById, loaded } = useArticles();
  const { articleComments, addArticleComment, deleteComment } = useComments();
  const { localize } = useTranslations();
  const { locale } = useLocale();
  const t = useT();

  // 英文页：把已审校的译文套到中文原文上（缺译字段逐项回退中文）
  const rawArticle = getById(id || '');
  const localized = useMemo(
    () => (rawArticle ? localize(rawArticle) : null),
    [rawArticle, localize],
  );
  const article = localized?.article;

  /* 章节按 order 排好：先 slice() 再排，**不动 novel.chapters 本身**（与书架页同一口径） */
  const chapters = useMemo(
    () => (article?.novel?.chapters || []).slice().sort((a, b) => a.order - b.order),
    [article],
  );

  /* 进度（口径与旧阅读器一致）：切到哪章就算读到那章，存章 id */
  const progKey = 'novel-progress-' + (article?.id || id || '');
  const [progress, setProgress] = useLocalStorage<{ chapterId?: string }>(progKey, {});

  const chapterKey = search.get('ch') || undefined;

  /* 落点：① 地址里的 `?ch=`（书架/书介页点某一章）→ ② 上次读到的章 → ③ 第 1 章 */
  const curIx = useMemo(() => {
    if (!chapters.length) return 0;
    if (chapterKey) {
      const byId = chapters.findIndex((ch) => ch.id === chapterKey);
      if (byId >= 0) return byId;
      const n = Number(chapterKey);
      if (Number.isFinite(n) && n >= 1 && n <= chapters.length) return Math.floor(n) - 1;
    }
    const saved = chapters.findIndex((ch) => ch.id === progress.chapterId);
    return saved >= 0 ? saved : 0;
  }, [chapters, chapterKey, progress.chapterId]);

  const cur = chapters[curIx];

  const chapterWords = cur
    ? formatCountLabel(cur.counts, cur.content, locale, t) ||
      t('count.words', { n: formatCount(cur.wordCount || 0) })
    : '';

  usePageTitle(article ? (cur ? `${article.title} · ${cur.title}` : article.title) : undefined);

  /* 正文那一段的锚点：翻章后滚到这里（旧版滚的是全屏阅读容器，现在是页面本身）。 */
  const bodyRef = useRef<HTMLElement>(null);

  const goTo = (ix: number) => {
    const next = Math.max(0, Math.min(chapters.length - 1, ix));
    const ch = chapters[next];
    if (!ch) return;
    setProgress({ chapterId: ch.id });
    setSearch({ ch: ch.id }, { replace: true });
    bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* 带 `?ch=` 进来：页面直接落到「本章正文」（只做一次）。
     数据是异步来的，所以要等章节到位；不带 `?ch=` 时不做任何滚动（第一眼是报头）。 */
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (jumpedRef.current || !chapterKey || !chapters.length) return;
    jumpedRef.current = true;
    bodyRef.current?.scrollIntoView({ block: 'start' });
  }, [chapterKey, chapters.length]);

  // 键盘左右翻章（输入框里不抢键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') goTo(curIx + 1);
      if (e.key === 'ArrowLeft') goTo(curIx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIx, chapters.length]);

  /* 顶部阅读进度细线：与文章阅读页同一件东西（`.art-prog`，2px 青蓝，宽度＝本页滚动进度）。
     直接写 DOM 不 setState——滚动逐帧触发，走 state 会把整章正文每帧重渲。 */
  const progressBarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const apply = () => {
      const de = document.documentElement;
      const max = de.scrollHeight - de.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, de.scrollTop / max)) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
    };
    apply();
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
    };
  }, [id, article, curIx]);

  /* 数据还没拉回来时**不能**判「不存在」——预渲染首屏就靠注入的那一篇，
     否则硬刷新本页会被自己弹回书架。 */
  if (!article) {
    if (!loaded) {
      return (
        <section className="sec">
          <p className="gnote">{t('common.loading')}</p>
        </section>
      );
    }
    return (
      <section className="sec">
        <p className="gnote">
          {t('article.notFound')}
          <Link to="/novels" className="btn">{t('shelf.title')}</Link>
        </p>
      </section>
    );
  }

  // 不是小说（没章节的普通文章被手输到本路由）→ 交给文章阅读页
  if (!isNovelArticle(article)) return <Navigate to={`/article/${article.id}`} replace />;

  // 小说但没有章节：没有可读的正文，回书介页
  if (!chapters.length || !cur) return <Navigate to={novelHref(article.id)} replace />;

  const meta = CATEGORY_META[article.category];
  const comments = articleComments.filter(
    (c) => c.articleId === article.id || c.articleId.startsWith(article.id + '::'),
  );

  return (
    <>
      {/* 阅读进度：视口最上沿一条 2px 青蓝细线（与文章页、书介页同一件） */}
      <div className="art-prog" aria-hidden="true">
        <i ref={progressBarRef} />
      </div>

      {/* 报头：小签＝「返回书籍」（点回书介页）＋ #标签 ｜ 巨幅衬线**章名** ｜ 副题＝分卷名 ｜ 署名条＝
          书名 · 共 N 章 · 第 i/N 章 · 本章字数。类名全部取自样张 `.pagehead`。 */}
      <section className="pagehead" style={{ '--c': meta.color } as CSSProperties}>
        <div className="pagehead-txt">
          <div className="kicker">
            <Link to={novelHref(article.id)} className="kick-cat">‹ {t('shelf.backToBook')}</Link>
            {article.tags.map((tag) => (
              <span key={tag} className="kick-tag">#{tag}</span>
            ))}
          </div>
          <h1 className={n1TitleClass(cur.title)}>{cur.title}</h1>
          {cur.part && <p className="lede">{cur.part}</p>}
          <div className="meta">
            <span>{article.title}</span>
            <span>{t('count.chapters', { n: chapters.length })}</span>
            <span>{curIx + 1} / {chapters.length}</span>
            {chapterWords && <span>{chapterWords}</span>}
          </div>
        </div>
      </section>

      {/* 英文页缺译提示：整本没英文一行；只有部分章节有英文另一行 */}
      {locale === 'en' && localized && !localized.translated && (
        <p className="gnote art-note">{t('article.zhOnly')}</p>
      )}
      {locale === 'en' && localized?.translated && localized.chapterFallback && (
        <p className="gnote art-note">{t('article.partialZh')}</p>
      )}

      <NovelReader
        article={article}
        chapters={chapters}
        curIx={curIx}
        onGoTo={goTo}
        allComments={comments}
        onAddComment={(articleId, input) => addArticleComment(articleId, input)}
        onDeleteComment={(cid) => deleteComment(cid, 'comment')}
        currentUserId={user?.id}
        bodyRef={bodyRef}
      />
    </>
  );
}
