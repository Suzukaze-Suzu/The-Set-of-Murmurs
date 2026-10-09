import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useTranslations } from '../context/TranslationContext';
import { CATEGORIES, CATEGORY_META, NOVEL_STATUS_META } from '../types';
import type { Article } from '../types';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey } from '../i18n/dict';
import { formatCountLabel, sumChapterCounts, formatCount, stripForWordCount } from '../lib/wordCount';
import { articleHref, novelReadHref } from '../lib/novelPath';

/* 报眼方框里的头像（站点既有素材，原样使用）：取不到站长头像时兜底 */
const AVATAR_FALLBACK = '/avatar-original.png';

interface Props {
  query: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   首页（2026-10-08「N1 样张直接做前端」）
   ──────────────────────────────────────────────────────────────────────────────
   版式**逐块照 `design-mockups\g\n1-broadsheet\index.html` 行 450–552**，类名一个不改：
     ① 报眼      .hero.hero-mast ＝ .hero-txt（.stats 版面统计＋.cta 两个入口）＋ .hero-face 头像方框
     ② 最新更新  .sec#latest ＝ .lead 本期头条（.lead-k/.lead-ex/.lead-body 两栏正文/.meta）
                              ＋ .recent 右栏四条（.subhead ＋ .item）
     ③ 置顶与收藏 .duo 两个 .feat 方框专栏
     ④ 书籍更新  .book 报讯块（封面＋书名＋状态小签＋章数字数＋最新一章）
     ⑤ 分类浏览  .tiles 报尾索引带（色块＝分类色卡色，**分类彩点照旧豁免、一字未改**）
   数据、字数口径（formatCountLabel）、i18n、收藏/置顶逻辑**一行没改**。

   ⚠️ 样张首页**没有搜索态**（报头也没有搜索框），所以首页不再自己渲染搜索结果；
      搜索仍在「全部文章」页（旧外壳）里，要不要搬进 N1 等用户点名（见计划书 §6）。
   ⚠️ 样张首页也没有「开始写作」按钮（那是管理员才有的入口），故本页不出——同样列进 §6。
   ⚠️ 回退＝`git checkout -- src/pages/Home.tsx`。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function Home({ query }: Props) {
  const t = useT();
  const { locale } = useLocale();
  usePageTitle(query.trim() ? t('home.titleSearch', { q: query.trim() }) : undefined);
  const { articles, getByCategory } = useArticles();
  const { profile } = useProfile();
  const { localize } = useTranslations();

  /* 「最新更新」按 articles.date 倒序（与各页原来的排法一致）；与「置顶与收藏」刻意不去重 */
  const latest = useMemo(() => [...articles].sort((a, b) => b.date.localeCompare(a.date)), [articles]);
  const latestBig = latest[0];
  const latestSmall = latest.slice(1, 5);

  const featured = useMemo(
    () =>
      articles
        .filter((a) => a.pinned || a.favorite)
        .sort((a, b) => (a.pinned === b.pinned ? b.date.localeCompare(a.date) : a.pinned ? -1 : 1))
        .slice(0, 4),
    [articles]
  );

  /* 「书籍更新」：只取真正有章节的小说（与书架页同一判据），按 date 倒序，最多 3 本 */
  const novels = useMemo(
    () =>
      articles
        .filter((a) => a.category === 'reading' && (a.novel?.chapters?.length || 0) > 0)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [articles]
  );
  const bookCards = novels.slice(0, 3);

  /* 头条的正文（样张的 .lead-body 是**真正文、不是摘要**）：
     2026-10-09 用户拍板「最新更新的文章直接把大部分的内容显示在主页，把空白占满，
     放不下的才会到里面去看」——所以这里给出**尽量多**的段落（原来只取前 3 段），
     由 CSS 按版面高度裁切（`n1-app.css` ⑫ 段：绝对定位铺满左栏 ＋ `column-fill:auto`
     ＋ 底部渐隐）。上限 80 段只是防超长文把 DOM 撑大，不是内容判据。 */
  const leadBody = useMemo(() => {
    if (!latestBig) return [] as string[];
    const txt = stripForWordCount(localize(latestBig).article.content || '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/[ \t]+/g, ' ');
    return txt
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 1)
      .slice(0, 80);
  }, [latestBig, localize]);

  /* 一次量尺（只为边界情况）：`scrollWidth > clientWidth` 说明两栏**真的被裁过** → 保持 CSS 的
     `column-fill:auto`；否则说明这篇填不满版面 → 挂 `.is-short` 回到样张原本的两栏均衡，
     免得短文只剩左边一栏、右边空掉。量不到就什么都不加，退回纯 CSS 那条路（安全失败）。 */
  const bodyRef = useRef<HTMLDivElement>(null);
  const [leadShort, setLeadShort] = useState(false);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = () => setLeadShort(el.scrollWidth <= el.clientWidth + 1);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(check).catch(() => {});
    }
    return () => ro?.disconnect();
  }, [leadBody, locale]);

  /* 版面统计条（样张的 .stats）：篇文章 / 个分类 / 本书 / 双站——全部由真实数据现算 */
  const statsUnits = t('home.statsUnits').split('|');
  const stats: { b: string; s: string }[] = [
    { b: formatCount(articles.length), s: statsUnits[0] || '' },
    { b: String(CATEGORIES.length), s: statsUnits[1] || '' },
    { b: String(novels.length), s: statsUnits[2] || '' },
    { b: t('about.statBilingualVal'), s: statsUnits[3] || '' },
  ];

  /* 小清单 / 头条 / 索引带共用的取数：本地化 + 分类色卡色 + 计数口径 */
  const entryOf = (raw: Article) => {
    const loc = localize(raw);
    const a = loc.article;
    const chapters = a.novel?.chapters || [];
    const label = formatCountLabel(
      chapters.length ? sumChapterCounts(chapters) : loc.counts,
      chapters.length ? chapters.map((ch) => ch.content || '').join('\n') : a.content,
      locale,
      t
    );
    return { a, meta: CATEGORY_META[a.category], label };
  };

  return (
    <>
      {/* ===== ① 报眼（.hero.hero-mast）=====
          站名/标语/提要已由报头承载（N1 也是这样），这里只留「署名统计条 ＋ 两个入口 ＋ 主编头像方框」 */}
      <section className="hero hero-mast">
        <div className="hero-txt">
          <ul className="stats">
            {stats.map((s) => (
              <li key={s.s}>
                <b>{s.b}</b>
                <span>{s.s}</span>
              </li>
            ))}
          </ul>
          <div className="cta">
            <a className="btn" href="#latest">{t('home.startReading')}</a>
            <Link className="btn ghost" to="/about">{t('home.aboutSite')}</Link>
          </div>
        </div>
        <figure className="hero-face">
          <img src={profile.avatar || AVATAR_FALLBACK} alt={locale === 'en' ? t('brand.author') : profile.nickname || t('brand.author')} width={200} height={200} />
        </figure>
      </section>

      {/* ===== ② 最新更新（.sec#latest ＝ .lead 头条 ＋ .recent 右栏四条）===== */}
      {latestBig && (
        <section className="sec" id="latest">
          <div className="sec-head">
            <h2>{t('home.latestUpdates')}</h2>
            <small>LATEST</small>
          </div>
          <div className="latest">
            {(() => {
              const { a, meta, label } = entryOf(latestBig);
              return (
                <article className="lead" style={{ '--c': meta.color } as CSSProperties}>
                  <div className="lead-k">
                    <span className="cat">{t(catKey(a.category))}</span>
                    <span className="lead-flag">{t('home.leadFlag')}</span>
                  </div>
                  <h3>
                    <Link to={`/article/${a.id}`}>{a.title}</Link>
                  </h3>
                  {a.summary && <p className="lead-ex">{a.summary}</p>}
                  {leadBody.length > 0 && (
                    <div className={`lead-body${leadShort ? ' is-short' : ''}`} ref={bodyRef}>
                      {leadBody.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  )}
                  <div className="meta">
                    <span>{formatDate(a.date, locale)}</span>
                    {label && <span>{label}</span>}
                    {/* 正文被版面裁掉时的出口（内容填不满就不出，避免无意义的「继续阅读」） */}
                    {!leadShort && (
                      <Link className="more" to={`/article/${a.id}`}>
                        {t('home.continueReading')} ›
                      </Link>
                    )}
                  </div>
                </article>
              );
            })()}

            {latestSmall.length > 0 && (
              <div className="recent">
                <div className="subhead">
                  <b>{t('home.recentSubhead')}</b>
                  <small>MORE RECENT</small>
                </div>
                {latestSmall.map((raw) => {
                  const { a, meta, label } = entryOf(raw);
                  return (
                    <article key={a.id} className="item" style={{ '--c': meta.color } as CSSProperties}>
                      <div className="item-txt">
                        <span className="cat">{t(catKey(a.category))}</span>
                        <h3>
                          <Link to={`/article/${a.id}`}>{a.title}</Link>
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
            )}
          </div>
        </section>
      )}

      {/* ===== ③ 置顶与收藏（.duo 两个 .feat 方框）===== */}
      <section className="sec" id="featured">
        <div className="sec-head">
          <h2>{t('home.pinnedSaved')}</h2>
          <small>PINNED &amp; SAVED</small>
        </div>
        <div className="duo">
          {featured.map((raw) => {
            const { a, meta, label } = entryOf(raw);
            return (
              <article key={a.id} className="feat" style={{ '--c': meta.color } as CSSProperties}>
                <div className="feat-k">
                  <b>{a.pinned ? t('cat.pinned') : t('cat.save')}</b>
                  {t(catKey(a.category))} · {formatDate(a.date, locale)}
                </div>
                <h3>
                  <Link to={`/article/${a.id}`}>{a.title}</Link>
                </h3>
                {a.summary && <p>{a.summary}</p>}
                {label && <div className="meta"><span>{label}</span></div>}
              </article>
            );
          })}
        </div>
      </section>

      {/* ===== ④ 书籍更新（.book 报讯块）===== */}
      {bookCards.length > 0 && (
        <section className="sec" id="books">
          <div className="sec-head">
            <h2>{t('home.bookUpdates')}</h2>
            <small>BOOKS</small>
          </div>
          {bookCards.map((raw) => {
            const { a, label } = entryOf(raw);
            const novel = a.novel;
            const chapters = (novel?.chapters || []).slice().sort((x, y) => x.order - y.order);
            const latestCh = chapters[chapters.length - 1]; // 不用 .at(-1)：lib 只到 ES2020
            const statusMeta = novel?.status ? NOVEL_STATUS_META[novel.status] : null;
            const words =
              label || t('count.words', { n: formatCount(novel?.wordCount || 0) });
            return (
              <div className="book" key={a.id}>
                <figure className="book-cover">
                  {novel?.cover && <img src={novel.cover} alt={t('common.coverAlt', { t: a.title })} loading="lazy" />}
                </figure>
                <div className="book-txt">
                  <h3>
                    {/* 书籍入口＝书架族的阅读界面（2026-10-09「小说界面绑定到书架」） */}
                    <Link to={articleHref(a)}>{a.title}</Link>
                  </h3>
                  <div className="book-meta">
                    {statusMeta && (
                      <span className="badge">
                        {novel?.status ? t(`cat.${novel.status}` as 'cat.serializing') : statusMeta.label}
                      </span>
                    )}
                    <span>{t('count.chaptersWords', { n: chapters.length, m: words })}</span>
                  </div>
                  {novel?.synopsis && <p>{novel.synopsis}</p>}
                  {latestCh && (
                    <div className="book-latest">
                      <b>{t('home.newTag')}</b>
                      {latestCh.part ? `${latestCh.part} · ` : ''}
                      {latestCh.title}
                      {/* 「最新一章 ›」直接落到那一章（2026-10-09 第二轮起＝阅读界面 `/novels/<id>/read?ch=`） */}
                      <Link className="more" to={latestCh ? novelReadHref(a.id, latestCh.id) : articleHref(a)}>
                        {t('article.read')} ›
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ===== ⑤ 分类浏览（.tiles 报尾索引带）===== */}
      <section className="sec" id="cats">
        <div className="sec-head">
          <h2>{t('home.browseByCategory')}</h2>
          <small>BY CATEGORY</small>
        </div>
        <div className="tiles">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            return (
              <Link key={c} to={`/category/${c}`} className="tile" style={{ '--c': meta.color } as CSSProperties}>
                <b>{t(catKey(c))}</b>
                <span className="n">{getByCategory(c).length}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
