import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useComments } from '../context/CommentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/TranslationContext';
import { CATEGORY_META } from '../types';
import MarkdownRenderer, { Heading } from '../components/MarkdownRenderer';
import N1Comments from '../components/n1/N1Comments';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey } from '../i18n/dict';
import { formatCountLabel } from '../lib/wordCount';
import { isNovelArticle, novelHref } from '../lib/novelPath';
import { n1TitleClass } from '../lib/n1TitleSize';

/* ══════════════════════════════════════════════════════════════════════════════
   阅读页（2026-10-09 迁入 N1）
   ──────────────────────────────────────────────────────────────────────────────
   用户原话：「修改文章界面以及具体阅读界面，设计为与其他页面类似风格」；裁决四条：
     ① 正文＝「**单栏，类似报纸大版，不变窄**」——`.prose` 在 n1.css 里是三栏（关于页口径），
        这里按你的口径挂 `.prose-read`（`n1-app.css` 里一条 `column-count:1`），版心仍占满整幅；
     ② 三件样张外的东西（**进度细线／可折叠目录／附件＋评论区**）＝「**功能保留，但是风格修改**」；
     ③ 评论借留言板那套 `.gform`/`.msgs`/`.msg` 语汇（见 `components/n1/N1Comments.tsx`）；
     ④ 小说那篇（category=reading 且有章节）「**一起改：小说也不受沉浸页**」→ 交给 NovelReader 的 N1 版。
       ★ 2026-10-09 改判：小说界面**整块搬去书架族**（`/novels/<书id>`，见 pages/NovelDetail.tsx）——
       本页遇到小说只做一次 replace 重定向，旧链接照样能用，但小说不再停在「文章」路由下。
   版式全部用样张零件：`.pagehead`（分类小签＋#标签／h1／summary）＋`.meta` 署名条
     ＋`.toc` 点线目录（套在 `<details>` 里，桌面默认展开）＋`.list` 时代没有的多栏正文
     ＋`.att` 附件清单 ＋`.sec-head` 版带 ＋`.msgs` 读者来信。
   **逻辑一行没动**：数据与本地化、字数口径（formatCountLabel）、导出 .md 的 Blob 与文件名规则、
   两级 confirm 文案、NovelReader 分支、评论的增删与回复、返回首页空态、切文章 `scrollTo(0,0)`、
   目录桌面默认开／手机折叠且「用户点过之后不再自动改」（dataset.touched）全部原样。
   回退＝`git checkout -- src/pages/ArticleDetail.tsx` ＋ 从 `n1Routes.ts` 删掉 `/article` 一条。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { getById, toggleFavorite, deleteArticle, loaded } = useArticles();
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

  /* ── 阅读进度细线（2026-10-08 批次② P4 起，2026-10-09 换成 N1 口径）─────────────
     原来那条线贴在旧 sticky 顶栏下沿、顶距要跟着顶栏滑走与否现算；N1 报头**不是 sticky**，
     所以现在固定在视口最上沿（`.art-prog`，2px 青蓝细线，宽度＝本页滚动进度）。
     **直接写 DOM、不 setState**：滚动是逐帧事件，走 state 会把整篇 Markdown 每帧重渲一次。 */
  const progressBarRef = useRef<HTMLElement>(null);
  const tocRef = useRef<HTMLDetailsElement>(null);

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

  useEffect(() => {
    const el = tocRef.current;
    if (!el) return;
    const mq = window.matchMedia('(min-width:1100px)');
    const apply = () => {
      if (el.dataset.touched !== '1') el.open = mq.matches;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [headings.length]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!article) {
    /* ⚠️ 2026-10-09 实测（first\n1-article-pages\probe-oldnovel.mjs）：
       冷启动直接打开 /article/<id> 时文章表还没回来，`getById` 必然落空，旧代码**立刻**报
       「文章不存在或被删除了」，而且这句话会一直挂着（组件不重试）——实测等满 26 秒仍是这句，
       同一个 id 换成站内跳转（provider 已有数据）就正常进到书/文章。
       **数据没回来 ≠ 文章不存在**：表还没到就显示 `.gnote` 的「加载中…」，只有表已经落地
       （`loaded === true`）才敢说不存在。
       （同族写法在 pages\NovelDetail.tsx 里也一样，那一页属小说线，由那边的窗口按同一行改。） */
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
          <Link to="/" className="btn">{t('article.backHome')}</Link>
        </p>
      </section>
    );
  }

  const meta = CATEGORY_META[article.category];

  /* ★ 2026-10-09「小说界面绑定到书架」：小说一律转去 `/novels/<书id>` 的阅读界面。
     用 replace（不是 push）——旧链接打开后不会在浏览器里留下「文章页」这一跳。
     判据与书架页/首页「书籍更新」同一口径（lib/novelPath.ts）。 */
  if (isNovelArticle(article)) return <Navigate to={novelHref(article.id)} replace />;

  /* ★ 字数（2026-09-22）：本是文章专属，小说已在上面转走，所以口径不变
     （中文站＝`801 字`；英文站：整篇没译＝`N characters`、译完＝`N words`、只译了一部分＝两者并排）。 */
  const wordsLabel = formatCountLabel(localized?.counts, article.content, locale, t);

  // 导出为 .md 文件
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
    if (!window.confirm('确定要删除这篇文章吗？删除后无法恢复。')) return;
    const confirmed = window.confirm('再次确认：真的要删除「' + article.title + '」吗？');
    if (!confirmed) return;
    deleteArticle(article.id);
    navigate('/articles');
  };

  return (
    <>
      {/* ⑪ 阅读进度：视口最上沿一条 2px 青蓝细线，宽度＝本页滚动进度 */}
      <div className="art-prog" aria-hidden="true">
        <i ref={progressBarRef} />
      </div>

      {/* 报头：分类小签（可点回分类页）＋ #标签 ｜ 巨幅衬线标题 ｜ 副题＝summary ｜ 署名条 */}
      <section className="pagehead" style={{ '--c': meta.color } as CSSProperties}>
        <div className="pagehead-txt">
          <div className="kicker">
            <Link to={`/category/${article.category}`} className="kick-cat">{t(catKey(article.category))}</Link>
            {article.tags.map((tag) => (
              <span key={tag} className="kick-tag">#{tag}</span>
            ))}
          </div>
          <h1 className={n1TitleClass(article.title)}>{article.title}</h1>
          {article.summary && <p className="lede">{article.summary}</p>}
          <div className="meta">
            <span>{formatDate(article.date, locale)}</span>
            {wordsLabel && <span>{wordsLabel}</span>}
            {isAdmin && (
              <button className="btn ghost" onClick={() => toggleFavorite(article.id)}>
                {article.favorite ? t('article.savedStar') : t('article.saveStar')}
              </button>
            )}
            {isAdmin && <button className="btn ghost" onClick={exportMarkdown}>{t('article.exportMd')}</button>}
            {isAdmin && <Link to={`/write/${article.id}`} className="btn ghost">编辑文章</Link>}
            {isAdmin && <button className="btn ghost" onClick={afterDelete}>删除文章</button>}
          </div>
        </div>
      </section>

      {/* 英文页的缺译提示（P3）：整篇没英文＝一行提示。
          （「小说只有部分章节有英文」那一行随小说一起搬去 NovelDetail 了） */}
      {locale === 'en' && localized && !localized.translated && (
        <p className="gnote art-note">{t('article.zhOnly')}</p>
      )}

      <>
        {/* ⑥ 目录（headings.length > 1 才有；桌面默认展开、手机折叠，见上面的 effect）。
            文案仍是字典里的 `article.contents`（📑 目录），一个字节没改。 */}
        {headings.length > 1 && (
          <section className="sec">
            <details
              className="toc-details"
              ref={tocRef}
              onToggle={(e) => {
                if ((e.nativeEvent as Event).isTrusted) e.currentTarget.dataset.touched = '1';
              }}
            >
              <summary className="toc-toggle">{t('article.contents')}</summary>
              <ol className="toc">
                {headings.map((h, i) => (
                  <li key={h.id} className={`toc-lv${h.level}`}>
                    <span className="no">{String(i + 1).padStart(2, '0')}</span>
                    <a
                      className="tt"
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          </section>
        )}

        {/* ⑦ 正文：单栏、占满整幅（用户口径「单栏，类似报纸大版，不变窄」） */}
        <section className="sec">
          <article className="prose prose-read">
            <MarkdownRenderer content={article.content} onHeadings={handleHeadings} />
          </article>
        </section>
      </>

      {/* ⑧ 附件：报纸的「附件」清单（📎、文件名、KB 一个没少） */}
      {article.attachments && article.attachments.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2>{t('article.attachments', { n: article.attachments.length })}</h2>
            <small>FILES</small>
          </div>
          <ul className="att">
            {article.attachments.map((att, i) => (
              <li key={i}>
                <a href={att.url} target="_blank" rel="noreferrer" className="att-item">
                  <span className="att-icon">📎</span>
                  <span className="att-name">{att.name}</span>
                  {att.size ? <span className="att-size">{(att.size / 1024).toFixed(1)} KB</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ⑨ 评论区 → 「读者来信」栏（版带 ＋ 留言板那一套语汇）。
          小说在上面的重定向里已转走，所以这里不再需要 isNovel 判定。 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('comment.deskTitle')}</h2>
          <small>{t('comment.count', { n: comments.length })}</small>
        </div>
        <N1Comments
          comments={comments}
          onAdd={(name, content, parentId, parentName, avatar) => addArticleComment(article.id, { name, content, parentId, parentName, avatar })}
          currentUserId={user?.id}
          onDelete={(cid) => deleteComment(cid, 'comment')}
        />
      </section>
    </>
  );
}
