import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useComments } from '../context/CommentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/TranslationContext';
import { CATEGORY_META } from '../types';
import N1Comments from '../components/n1/N1Comments';
import NovelToc from '../components/novel/NovelToc';
import ReaderSettings from '../components/novel/ReaderSettings';
import { usePageTitle } from '../hooks/usePageTitle';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey, novelStatusKey } from '../i18n/dict';
import { isNovelArticle, novelHref, novelReadHref } from '../lib/novelPath';
import { n1TitleClass } from '../lib/n1TitleSize';
import { formatCountLabel, sumChapterCounts, formatCount } from '../lib/wordCount';

/* ══════════════════════════════════════════════════════════════════════════════
   小说书介页（2026-10-09 第二轮：正文被搬去独立的阅读界面后，本页只剩「介绍 + 入口」）
   ──────────────────────────────────────────────────────────────────────────────
   用户点选：**「书讯 ＋ 目录 ＋ 设置 ＋ 评论留在书介页，目录每条改成『进入阅读』」**，
   形态＝正文单独一页 `/novels/<书id>/read?ch=<章id>`（见 pages/NovelRead.tsx）。

   本页现在的构成（全部取自样张既有语汇，不发明新控件）：
     ① `.art-prog` 顶部阅读进度细线
     ② `.pagehead` 巨幅衬线书名 ＋ 简介 ＋ 署名条（编辑/收藏/导出/删除仍只对博主可见）
     ③ `.sec` 书讯 `.book.big`（书封／状态签／章数·字数·已读／简介／入口）
     ④ `.sec` 目录 `.toc`（共享零件），**每一条指向阅读界面那一章**
     ⑤ `.sec` 阅读设置 `.reader`（共享零件，四行含进度——原样保留）
     ⑥ `.sec` 整本评论（评论串＝书 id）

   ★ 与用户点选的两处**故意偏差**（汇报里点名让他删减）：
     · 「评论」在本页只留**整本评论**——本章评论在书介页没有「当前章」可依附，
       已随正文搬去阅读界面（那里仍然是 `书id::章id` 同一个评论串）。
     · 旧的 `/novels/<id>?ch=<章id>` 地址会做一次 replace 重定向到阅读界面同一章，旧链接不失效。

   逻辑一行没丢：`isNovelArticle` 判据、`localize` 英文译文回退、字数口径 `formatCountLabel`、
   收藏 `toggleFavorite`、导出 markdown、删除二次确认、进度 localStorage `novel-progress-<书id>`。
   回退＝`git checkout -- src/pages/NovelDetail.tsx`（旧版=正文也长在这一页）。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function NovelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { isAdmin, user } = useAuth();
  const { getById, toggleFavorite, deleteArticle, loaded } = useArticles();
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
  usePageTitle(article?.title);

  const novel = article?.novel;
  /* 章节按 order 排好：先 slice() 再排，**不动 novel.chapters 本身**（与书架页同一口径） */
  const chapters = useMemo(
    () => (novel?.chapters || []).slice().sort((a, b) => a.order - b.order),
    [novel],
  );

  /* 进度（口径不变）：切到哪章就算读到那章，存的是章 id。这一页只用它来显示
     「继续阅读 · <章名>」与 `.reader` 那一行的进度，**不写**（写进度的动作在阅读界面）。
     ⚠️ 存的章 id 可能已经不在章节表里（作者删过章）——那种情况一律当作「没读过」，
     否则会把「继续阅读」错指到第 1 章、进度条还会无端显示 100%。 */
  const [progress] = useLocalStorage<{ chapterId?: string }>('novel-progress-' + (article?.id || id || ''), {});
  const savedIx = chapters.findIndex((ch) => ch.id === progress.chapterId);
  const hasSaved = savedIx >= 0;
  const readIx = hasSaved ? savedIx : 0;
  const readPct = hasSaved && chapters.length ? Math.round(((readIx + 1) / chapters.length) * 100) : 0;
  const resumeChapter = hasSaved ? chapters[readIx] : undefined;

  /* 旧地址 `/novels/<id>?ch=<章id>`（上一轮「目录点章原地展开」时发出的链接）→
     一次 replace 重定向到阅读界面同一章。正文已不在这页，留着 `?ch=` 只会原地不动。 */
  const legacyChapterKey = search.get('ch') || undefined;

  /* 阅读进度细线（与阅读界面、文章页同一件东西）。直接写 DOM 不 setState。 */
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
  }, [id, article]);

  // 换书＝回到页首（与文章阅读页 `scrollTo(0,0)` 同一口径）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  /* 数据还没拉回来时**不能**判「不存在」——预渲染页首屏就靠注入的那一篇，
     否则硬刷新 `/novels/<id>` 会被自己弹回书架。 */
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

  // 旧地址带 `?ch=` → 阅读界面同一章
  if (legacyChapterKey) {
    return <Navigate to={novelReadHref(article.id, legacyChapterKey)} replace />;
  }

  const meta = CATEGORY_META[article.category];
  const bookComments = articleComments.filter((c) => c.articleId === article.id);
  const wordsLabel =
    formatCountLabel(
      sumChapterCounts(chapters),
      chapters.map((ch) => ch.content || '').join('\n'),
      locale,
      t,
    ) || t('count.words', { n: formatCount(novel?.wordCount || 0) });
  const statusMeta = novel?.status ? t(novelStatusKey(novel.status)) : '';

  // 导出为 .md（整本，正文＝各章拼接的 content，与写作页存进去的一样）
  const exportMarkdown = () => {
    const header = `# ${article.title}\n\n> ${article.summary || ''}\n\n**${t('article.mdDate')}** ${formatDate(article.date, locale)}\n**${t('article.mdCategory')}** ${t(catKey(article.category))}\n**${t('article.mdTags')}** ${article.tags.join(', ')}\n\n---\n\n`;
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
    if (!window.confirm('确定要删除这篇小说吗？删除后无法恢复。')) return;
    const confirmed = window.confirm('再次确认：真的要删除「' + article.title + '」吗？');
    if (!confirmed) return;
    deleteArticle(article.id);
    navigate('/novels');
  };

  return (
    <>
      {/* 阅读进度：视口最上沿一条 2px 青蓝细线 */}
      <div className="art-prog" aria-hidden="true">
        <i ref={progressBarRef} />
      </div>

      {/* 报头：小签＝「小说书架」（点回书架）＋ #标签 ｜ 巨幅衬线书名 ｜ 副题＝简介 ｜ 署名条 */}
      <section className="pagehead" style={{ '--c': meta.color } as CSSProperties}>
        <div className="pagehead-txt">
          <div className="kicker">
            <Link to="/novels" className="kick-cat">{t('shelf.title')}</Link>
            {article.tags.map((tag) => (
              <span key={tag} className="kick-tag">#{tag}</span>
            ))}
          </div>
          <h1 className={n1TitleClass(article.title)}>{article.title}</h1>
          {article.summary && <p className="lede">{article.summary}</p>}
          <div className="meta">
            <span>{formatDate(article.date, locale)}</span>
            {isAdmin && (
              <button className="btn ghost" onClick={() => toggleFavorite(article.id)}>
                {article.favorite ? t('article.savedStar') : t('article.saveStar')}
              </button>
            )}
            {isAdmin && <button className="btn ghost" onClick={exportMarkdown}>{t('article.exportMd')}</button>}
            {isAdmin && <Link to={`/write/${article.id}`} className="btn ghost">编辑小说</Link>}
            {isAdmin && <button className="btn ghost" onClick={afterDelete}>删除小说</button>}
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

      {/* 书讯：照样张 `novel.html` 的 `.book.big`（书封／书名／状态签＋章数·字数·已读／简介／入口）。
          入口＝**阅读界面**（`/novels/<书id>/read`）；读到过哪一章就显示「继续阅读 · <章名>」。 */}
      <section className="sec">
        <div className="book big">
          <figure className="book-cover">
            {novel?.cover
              ? <img src={novel.cover} alt={article.title} />
              : <div className="cover-ph" aria-hidden="true">{article.title.slice(0, 1)}</div>}
          </figure>
          <div className="book-txt">
            <h3>{article.title}</h3>
            <div className="book-meta">
              {statusMeta && <span className="badge">{statusMeta}</span>}
              <span>{t('count.chapters', { n: chapters.length })}</span>
              {wordsLabel && <span>{wordsLabel}</span>}
              {readPct > 0 && <span>{t('shelf.readPct', { p: readPct })}</span>}
              {novel?.author && <span>{t('shelf.byAuthor', { name: novel.author })}</span>}
            </div>
            {novel?.synopsis && <p>{novel.synopsis}</p>}
            <div className="cta">
              <Link className="btn" to={novelReadHref(article.id, resumeChapter?.id)}>
                {resumeChapter ? t('shelf.continueReading', { title: resumeChapter.title }) : t('shelf.startReading')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 目录：照样张 `.toc` 点线索引。**每一条都指向阅读界面那一章**（`/read?ch=<章id>`）——
          用户点选「目录每条改成『进入阅读』」，所以这里没有「原地展开正文」这条路了。 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('shelf.contents')}</h2>
          <small>CONTENTS</small>
        </div>
        <NovelToc
          chapters={chapters}
          hrefOf={(ch) => novelReadHref(article.id, ch.id)}
          partBreak
        />
      </section>

      {/* 阅读设置：与阅读界面**同一件零件、同一份 localStorage**（`novel-font`／`novel-line`／站内主题）。
          这一页保留四行（含进度）——它在这里不驱动正文，只是让「上次调好的档位」在这一页也看得见。 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('shelf.settings')}</h2>
          <small>READER</small>
        </div>
        <ReaderSettings curIx={readIx} total={chapters.length} />
      </section>

      {/* 整本评论（2026-10-09「加入整本书评论」）：与阅读界面那栏共用同一个评论串（`articleId = 书id`）。
          本章评论不在这页——它跟着正文去了阅读界面。 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('shelf.bookComments', { n: bookComments.length })}</h2>
          <small>WHOLE BOOK</small>
        </div>
        <N1Comments
          comments={bookComments}
          onAdd={(name, content, parentId, parentName, avatar) =>
            addArticleComment(article.id, { name, content, parentId, parentName, avatar })
          }
          currentUserId={user?.id}
          onDelete={(cid) => deleteComment(cid, 'comment')}
        />
      </section>
    </>
  );
}
