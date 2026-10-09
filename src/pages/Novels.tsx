import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useComments } from '../context/CommentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/TranslationContext';
import { CATEGORY_META } from '../types';
import type { NovelChapter } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import N1Comments from '../components/n1/N1Comments';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey, novelStatusKey } from '../i18n/dict';
import { formatCountLabel, sumChapterCounts, formatCount } from '../lib/wordCount';
import { articleHref, novelHref, novelReadHref } from '../lib/novelPath';

/* ══════════════════════════════════════════════════════════════════════════════
   书架页（2026-10-08「样张直接做前端」；2026-10-09「小说界面绑定到书架」）
   ──────────────────────────────────────────────────────────────────────────────
   主体逐块照 `design-mockups\g\n1-broadsheet\novel.html`，类名一个不改：
     · `.pagehead` + `.pagehead-txt`(.kicker/h1/.lede)          ← 样张 449-456
     · `.sec` 里的 `.book.big`（.book-cover/.book-txt/h3/.book-meta/.badge/.cta）
       —— 样张是**一本书一块**（458-467）
     · 该书的 `.sec` + `.sec-head` + `.toc`（.no/.tt/.meta/.go） ← 样张 468-474
     · `.sec` 里的 `.list`（.item/.item-txt/.cat/.meta）         ← 样张 484-504
   外壳（报头／报尾）由 N1Shell 提供，这里只写主体。

   ★ 2026-10-09 用户原话「书架逻辑修改，把小说界面直接绑定到小说书架界面，去掉无用按钮，
     加入整本书评论」，三件事各落一处：
     ① **绑定**：书名指向书架族的**书介页** `/novels/<书id>`；「开始阅读」按钮
        （2026-10-09 第三轮起）**一步进阅读界面** `/novels/<书id>/read?ch=<章id>`；
        目录里每一条指向**阅读界面** `/novels/<书id>/read?ch=<章id>`
        （2026-10-09 第二轮「阅读的时候把文字单独开一个界面」）；
        小说从此不在 `/article/<id>` 下（那边只做一次 replace 重定向）。
     ② **去掉无用按钮**：样张那条**静态**「阅读设置」栏（字号/底色/字体/进度，写死的装饰）
        整块撤掉——它既不可点也不反映真实设置；真正可用的设置栏在阅读界面里（NovelReader）。
     ③ **加入整本书评论**：每本书的目录下面接一栏 `shelf.bookComments`，
        与阅读页那栏共用同一个评论串（`articleId = 书id`）。

    ★ 2026-10-09 第三轮，用户原话「但是我现在需要点两遍才能到阅读界面，我希望从小说书架能够直接点进阅读界面」：
      以前书架那颗主按钮指**书介页** `/novels/<书id>`，而书介页长得和本页几乎一样（书讯＋目录＋评论），
      还得再点一次目录才到正文 —— 这就是「点两遍」。现在**一步到正文**（零件＝下面的 ShelfReadCta），
      落点口径与书介页那颗按钮完全一致：读过哪章就续哪章，没读过就第 1 章。
      书名那条链接**仍指书介页**（介绍＋目录＋阅读设置在那儿，也是阅读界面「返回书籍」的去处）。

   真实数据 0/1/n 本的处理（样张只有 1 本）：
     · 0 本 → `.prose` 里一句 `shelf.empty`（与 N1 语汇一致的空白态）；
     · n 本 → 每本重复「书讯 ＋ 目录 ＋ 整本评论」；
     · 「同分类文章」只出一次。

   数据与逻辑一行没丢：`category === 'reading'` 且有章节 ＝ 小说、字数一律走
   `lib/wordCount.ts` 的 `formatCountLabel`（中文站逐字沿用旧口径）、`toggleFavorite`
   仍是 ArticleContext 里那一个。章节排序先 `slice()` 再排，**不动 novel.chapters 本身**。
   ══════════════════════════════════════════════════════════════════════════════ */

/* ★ 书架那颗主按钮「一步进阅读界面」（2026-10-09 第三轮，用户原话见文件头 ★）。
   以前它指书介页 `/novels/<书id>`，而书介页与本页长得几乎一样，于是「点两遍」才到正文。
   现在的落点口径**与书介页那颗按钮一模一样**（NovelDetail.tsx 的 `.book .cta`）：
     · 读到过哪一章 → 「继续阅读 · <章名>」，地址带该章 `?ch=`；
     · 没读过、或存的那一章已被作者删掉（不在章节表里）→ 「开始阅读」，落到第 1 章。
   **必须带上 `?ch=`**：阅读界面只有看到 `?ch=` 才会把视口直接滚到正文（不带参就停在报头）。
   进度取 localStorage `novel-progress-<书id>`——与书介页、阅读界面同一份，键名一字不改；
   单开一个小零件是因为 hook 不能在 map 循环里调。 */
function ShelfReadCta({ novelId, chapters }: { novelId: string; chapters: NovelChapter[] }) {
  const t = useT();
  const [progress] = useLocalStorage<{ chapterId?: string }>('novel-progress-' + novelId, {});
  const resume = chapters.find((ch) => ch.id === progress.chapterId);
  return (
    <Link className="btn" to={novelReadHref(novelId, (resume ?? chapters[0])?.id)}>
      {resume ? t('shelf.continueReading', { title: resume.title }) : t('shelf.startReading')}
    </Link>
  );
}

export default function Novels() {
  const t = useT();
  const { locale } = useLocale();
  usePageTitle(t('shelf.title'));
  const { articles, toggleFavorite } = useArticles();
  const { articleComments, addArticleComment, deleteComment } = useComments();
  const { user } = useAuth();
  const { localize } = useTranslations();

  /* 小说判据与原来完全一致：`category === 'reading'` 且**有章节**；置顶排前。
     （filter 已经返回新数组，不会碰到 articles 本身。） */
  const novels = useMemo(
    () =>
      articles
        .filter((a) => a.category === 'reading' && a.novel?.chapters?.length)
        .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1)),
    [articles]
  );

  const totalChapters = novels.reduce((s, a) => s + (a.novel?.chapters?.length || 0), 0);

  /* 「同分类文章」＝小说分类下的全部文章（含还没有章节的），按日期倒序——与首页那条清单同一口径 */
  const sameCat = useMemo(
    () => articles.filter((a) => a.category === 'reading').slice().sort((a, b) => b.date.localeCompare(a.date)),
    [articles]
  );

  /* 蜂蜜金＝CATEGORY_META.reading 的色卡色（样张 `.toc li` / `.item` 写的就是 #E8C9A0，色号一个没换） */
  const HONEY = CATEGORY_META.reading.color;

  return (
    <>
      {/* 页头：逐行照样张 novel.html 449-456（.pagehead/.pagehead-txt/.kicker/h1/.lede）。
          样张那行提要「连载中的故事与它们的目录。」没有字典键，这里改放**真实书目统计**
          （共 N 本 · M 章，与旧页 `.cat-count` 同一个键与口径）。 */}
      <section className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">NOVELS · SHELF</div>
          <h1>{t('shelf.title')}</h1>
          <p className="lede">{t('count.booksChapters', { n: novels.length, m: totalChapters })}</p>
        </div>
      </section>

      {novels.length === 0 ? (
        /* 空书架：样张没有这一态，按用户口径给一句 N1 语汇的空白态（.prose 承载，文案走 shelf.empty） */
        <section className="sec">
          <div className="prose">
            <p>{t('shelf.empty')}</p>
          </div>
        </section>
      ) : (
        novels.map((raw) => {
          /* 英文页：书名/简介/章节正文换成已审校的译文（未译的逐项回退中文） */
          const loc = localize(raw);
          const a = loc.article;
          const novel = a.novel;
          /* 先 slice() 再按 order 排：不原地 sort（novel.chapters 是 state 里的同一个数组） */
          const chapters = (novel?.chapters || []).slice().sort((x, y) => x.order - y.order);
          const body = chapters.map((ch) => ch.content || '').join('\n');
          const wordsLabel =
            formatCountLabel(sumChapterCounts(chapters), body, locale, t) ||
            t('count.words', { n: formatCount(novel?.wordCount || 0) });
          /* 整本评论＝这个评论串（`articleId = 书id`）。章评走 `书id::章id`，不混进这一栏。 */
          const bookComments = articleComments.filter((c) => c.articleId === a.id);

          return (
            <Fragment key={a.id}>
              {/* 书讯：照样张 458-467（.book.big ＋ .book-cover/.book-txt/.book-meta/.badge/.cta） */}
              <section className="sec">
                <div className="book big">
                  <figure className="book-cover">
                    {novel?.cover && <img src={novel.cover} alt={t('common.coverAlt', { t: a.title })} loading="lazy" />}
                  </figure>
                  <div className="book-txt">
                    <h3>
                      <Link to={novelHref(a.id)}>{a.title}</Link>
                    </h3>
                    <div className="book-meta">
                      {novel?.status && <span className="badge">{t(novelStatusKey(novel.status))}</span>}
                      <span>{t('count.chaptersWords', { n: chapters.length, m: wordsLabel })}</span>
                      {/* 样张那行「更新于 2026-08-10」用的是文章日期（章节数据里没有日期字段）。
                          2026-10-09：前缀改走字典（原来写死中文，英文页会露「更新于」）。 */}
                      <span>{t('shelf.updatedOn', { d: formatDate(a.date, locale) })}</span>
                    </div>
                    {novel?.synopsis && <p>{novel.synopsis}</p>}
                    <div className="cta">
                      {/* 入口＝**阅读界面**（2026-10-09 第三轮：一步到正文，不再中转书介页）。
                          落点＝读到过的那一章 / 第 1 章 —— 零件见上面的 ShelfReadCta。
                          书名（h3）仍指书介页：介绍＋目录＋阅读设置在那儿。 */}
                      <ShelfReadCta novelId={a.id} chapters={chapters} />
                      {/* 样张的「加入收藏」接既有的 ArticleContext.toggleFavorite（未收藏显示 cat.save） */}
                      <button type="button" className="btn ghost" onClick={() => toggleFavorite(a.id)}>
                        {a.favorite ? t('cat.unsave') : t('cat.save')}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 目录：照样张 468-474（.sec-head ＋ .toc），序号 01/02…两位、按 chapters[].order */}
              <section className="sec">
                <div className="sec-head">
                  <h2>{t('shelf.contents')}</h2>
                  <small>CONTENTS</small>
                </div>
                <ol className="toc">
                  {chapters.map((ch, i) => (
                    <li key={ch.id} style={{ '--c': HONEY } as CSSProperties}>
                      <span className="no">{String(i + 1).padStart(2, '0')}</span>
                      {/* 2026-10-09 第二轮：章名与「阅读 ›」都指向**阅读界面那一章**
                          （`/novels/<书id>/read?ch=<章id>`）——书架点目录＝直接开始读正文。 */}
                      <Link className="tt" to={novelReadHref(a.id, ch.id)}>
                        {ch.part ? `${ch.part} · ${ch.title}` : ch.title}
                      </Link>
                      {/* 章节没有自己的日期字段，故这里只有字数（见报告缺口清单） */}
                      <span className="meta">{formatCountLabel(ch.counts, ch.content, locale, t)}</span>
                      <Link className="go" to={novelReadHref(a.id, ch.id)}>{t('article.read')} ›</Link>
                    </li>
                  ))}
                </ol>
              </section>

              {/* 整本评论（2026-10-09「加入整本书评论」）：与阅读页那栏同一个评论串
                  （`articleId = 书id`），在书架这一层就能读、能回、能删。 */}
              <section className="sec">
                <div className="sec-head">
                  <h2>{t('shelf.bookComments', { n: bookComments.length })}</h2>
                  <small>WHOLE BOOK</small>
                </div>
                <N1Comments
                  comments={bookComments}
                  onAdd={(name, content, parentId, parentName, avatar) =>
                    addArticleComment(a.id, { name, content, parentId, parentName, avatar })
                  }
                  currentUserId={user?.id}
                  onDelete={(cid) => deleteComment(cid, 'comment')}
                />
              </section>
            </Fragment>
          );
        })
      )}

      {/* 同分类文章：照样张 484-504（.list 里的 .item/.item-txt/.cat/.meta），只出一次 */}
      {sameCat.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2>{t('shelf.moreInCategory')}</h2>
            <small>{t('shelf.inCategory', { c: t(catKey('reading')) })}</small>
          </div>
          <div className="list">
            {sameCat.map((raw) => {
              const loc = localize(raw);
              const a = loc.article;
              const chs = a.novel?.chapters || [];
              const label = chs.length
                ? formatCountLabel(
                    sumChapterCounts(chs),
                    chs.map((ch) => ch.content || '').join('\n'),
                    locale,
                    t
                  )
                : formatCountLabel(loc.counts, a.content, locale, t);
              return (
                <article key={a.id} className="item" style={{ '--c': CATEGORY_META[a.category].color } as CSSProperties}>
                  <div className="item-txt">
                    <span className="cat">{t(catKey(a.category))}</span>
                    <h3>
                      {/* 小说进书架族的阅读界面，其余进文章阅读页（lib/novelPath.ts 同一口径） */}
                      <Link to={articleHref(a)}>{a.title}</Link>
                    </h3>
                    {a.summary && <p>{a.summary}</p>}
                    <div className="meta">
                      <span>{formatDate(a.date, locale)}</span>
                      {label && <span>{label}</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
