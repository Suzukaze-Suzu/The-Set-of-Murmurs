import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, CATEGORY_META, NOVEL_STATUS_META } from '../types';
import type { Article } from '../types';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { searchArticles } from '../lib/search';

/* 空数组常量：useInfiniteList 依赖 items 引用稳定，别在渲染里现造 [] */
const NO_RESULTS: Article[] = [];
const SEARCH_PAGE_SIZE = 12;

interface Props {
  query: string;
}

/* 2026-09-20 首页改版（用户要求，方案用户已逐条审批：版本 2 / 最新区形态 D / 不去重 / 彩点换序 / 分类分区隐藏）
   本页最终结构＝hero → 最新更新 → 置顶与收藏 → 分类浏览（5 色块导航）。
   分类分区整段删掉：分类改从顶栏彩点（.nav-cats）和 /articles 的筛选按钮进，
   底部再补一排「分类浏览」色块把手机端的入口还回来（顶栏彩点在手机上收进汉堡菜单）。
   回滚＝把本文件换回 blog\first\home-layout-v1\Home.改动前.tsx。

   2026-09-20 追加（用户原话「我希望加一个小部分来放书籍更新」+「底下的分类能不能变成一行」）：
   ① 新增「书籍更新」区块（.book-section，放在「最新更新」**之后**、置顶区之前）：一本小说一张书籍卡
      （封面 / 书名 / 连载状态 / 章数·字数 / 最新章节名），按 date 倒序，一排最多 3 本；
      手机上 ≤640 折成单列竖排（书卡是横条形，一列比两列半宽更好读）。
      当晚第二轮他又说「书籍更新的方块丑，修改一下」→ 卡面在 index.css 里重做成
      「封面铺满卡高 + 衬线书名 + 状态与章数字数并排 + 最新一章带「阅读 ›」」；
      第三轮他说「书籍更新板块还是好丑」，定调「只调整方块排版，不要调整整体」→
      板块不动，只把 .book-* 的方块排布改掉（1 本时不再被钉在 3 列网格的左 1/3，改成居中陈列）。
   ② 「分类浏览」：第一轮按「变一行」做成恒定 5 列；第二轮他说「手机端可以接受两行的，
      让按钮根据宽度调整行数」→ 改成 auto-fit 按宽度自适应列数（桌面一行 5 张、手机折 2 行），不再横滑。

    2026-09-20 第四轮（搜索线，独立于上面三条）：顶栏搜索词进来时首页**自己出结果**，
    不再显示「正在为你跳转到全部文章」的横幅。回滚＝把本文件换回
    blog\first\home-search-inline\Home.改动前.tsx。 */
export default function Home({ query }: Props) {
  /* 有搜索词时标签页也跟着变成「搜索：xxx - 呓语集」（与 /articles 的口径一致） */
  usePageTitle(query.trim() ? `搜索：${query.trim()}` : undefined);
  const { articles, getByCategory, toggleFavorite } = useArticles();
  const { isAdmin } = useAuth();
  const { profile } = useProfile();

  /* ===== 首页直接出搜索结果（2026-09-20）=====
     用户原话：「首页搜索很别扭：搜完只弹一句『正在为你跳转…』，想在首页直接看到搜索结果」。
     改法：不再把人送去 /articles，首页自己跑同一套数据库全文搜索（lib/search.ts，300ms 防抖），
     结果用与 /articles 完全相同的卡片 + 滚动加载（useInfiniteList）渲染。
     搜索时整页只剩搜索结果区（原来那条 .search-banner 横幅不再用它，CSS 保留未删）。 */
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchArticles(q).then((res) => {
        if (!cancelled) {
          setSearchResults(res);
          setSearching(false);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const searchList = useMemo(() => searchResults ?? NO_RESULTS, [searchResults]);
  const {
    visible: searchVisible,
    hasMore: searchHasMore,
    total: searchTotal,
    sentinelRef: searchSentinelRef,
  } = useInfiniteList(searchList, SEARCH_PAGE_SIZE);

  /* 「最新更新」按 articles.date 倒序（日期是用户自己写的，跟各页原来的排法一致；
     articles 表没有 updated_at，没有更细的时间戳可用）。
     与下面「置顶与收藏」**刻意不去重**——用户明确选了「两边都显」。 */
  const latest = useMemo(
    () => [...articles].sort((a, b) => b.date.localeCompare(a.date)),
    [articles]
  );
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

  /* 「书籍更新」（2026-09-20 新增）：只取真正有章节的小说（与 /novels 书架同一个判据），
     按 date 倒序，一排最多 3 本。章节本身的顺序按 order 排，
     注意不要原地 sort —— chapters 是从 Context 里拿到的引用，sort 会改到别页的渲染顺序。 */
  const novels = useMemo(
    () =>
      articles
        .filter((a) => a.category === 'reading' && (a.novel?.chapters?.length || 0) > 0)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [articles]
  );
  const bookCards = novels.slice(0, 3);

  /* 有搜索词 → 首页直接给结果（用户 2026-09-20 拍板）。
     顺序与 /articles 一致：数据库已按 pinned desc, date desc 排好，这里不再重排。
     整页替换：搜索时首页的 hero / 最新更新 / 书籍更新 / 分类浏览全部不渲染。 */
  if (query.trim()) {
    return (
      <div className="page home">
        <section className="home-search-section">
          <div className="cat-section-head">
            <h2 className="section-title">搜索结果</h2>
            <Link to="/articles" className="more-link">
              在全部文章里看<span className="more-arrow">›</span>
            </Link>
          </div>
          <p className="result-count">
            搜索 “<strong>{query}</strong>”，{searching ? '搜索中…' : <>共 {searchTotal} 篇</>}
          </p>

          {searchList.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon empty-icon-magnifier" />
              <p>{searching ? '搜索中…' : '没有找到匹配的文章'}</p>
            </div>
          ) : (
            <>
              <div className="card-grid wide">
                {searchVisible.map((a) =>
                  a.novel?.chapters?.length ? (
                    <NovelCard key={a.id} article={a} />
                  ) : (
                    <ArticleCard key={a.id} article={a} onToggleFavorite={toggleFavorite} />
                  )
                )}
              </div>
              {searchHasMore ? (
                <div ref={searchSentinelRef} className="list-loading">滚动加载更多…</div>
              ) : (
                <p className="list-end">已加载全部 {searchTotal} 篇</p>
              )}
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="page home">
      {/* 头部横幅：浅底深字（亮色主题下对比度达标） */}
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">呓语集</h1>
          <p className="hero-sub">{profile.signature}</p>
          <p className="hero-desc">{profile.intro}</p>
          <div className="hero-cta">
            {isAdmin && <Link to="/write" className="btn btn-primary">开始写作</Link>}
            <Link to="/articles" className="btn btn-light-outline">浏览全部</Link>
          </div>
        </div>
      </section>

      {/* ===== 最新更新 =====
          形态 D：左边 1 张大卡（最新那一条）+ 右边 4 条小清单（分类彩点 + 标题 + 日期）。
          排版全走 .latest-*，竖条用默认的天空蓝→青蓝渐变（非分类标题，不传 --sec-color）。 */}
      {latestBig && (
        <section className="latest-section">
          <div className="cat-section-head">
            <h2 className="section-title">最新更新</h2>
            <Link to="/articles" className="more-link">
              更多<span className="more-arrow">›</span>
            </Link>
          </div>
          <div className={`latest-wrap${latestSmall.length ? '' : ' single'}`}>
            <div className="latest-big">
              {latestBig.novel?.chapters?.length ? (
                <NovelCard article={latestBig} />
              ) : (
                <ArticleCard article={latestBig} onToggleFavorite={toggleFavorite} />
              )}
            </div>
            {latestSmall.length > 0 && (
              <ul className="latest-list">
                {latestSmall.map((a) => {
                  const meta = CATEGORY_META[a.category];
                  return (
                    <li key={a.id} className="latest-item">
                      {/* 小圆点＝该分类的色卡色本身（分类的 ink 只给文字用，不当颜色） */}
                      <span className="latest-dot" style={{ background: meta.color }} aria-hidden="true" />
                      <div className="latest-item-main">
                        <Link to={`/article/${a.id}`} className="latest-item-title">{a.title}</Link>
                        <span className="latest-item-meta">
                          {meta.label} · {a.date}
                        </span>
                      </div>
                      <span className="latest-arrow" aria-hidden="true">›</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ===== 置顶与收藏（原样保留，与最新更新不去重） ===== */}
      <section className="featured-section">
        <h2 className="section-title">置顶与收藏</h2>
        <div className="card-grid">
          {featured.map((a) => (
            <ArticleCard key={a.id} article={a} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      </section>

      {/* ===== 书籍更新（2026-09-20 新增，用户原话「我希望加一个小部分来放书籍更新」）=====
          一本小说一张书籍卡：封面 + 书名 + 连载状态小签 + 「共 N 章 · M 字」+ 最新章节名。
          位置放在「最新更新」之后：博文更新仍是首页第一眼，书籍更新是紧随其后的一小块；
          若用户想让它更靠前，把这一整段移到「最新更新」那个 section 之前即可。
          配色跟随小说分类的色卡色（蜜金 #E8C9A0，与书架页 /novels 同口径）；
          状态小签的颜色改由 CSS 变量 --chip-color/--chip-ink 传（不再写 inline color），
          这样暗色主题才能覆盖——实测 inline 的蜜金系墨色压 13% 淡底在暗色只有 1.81:1，
          暗色下收敛成天空蓝 #5BA8D8（4.61:1），见 index.css 本段末尾的暗色覆盖。
          还没有任何章节的小说不进这一块（与书架页判据一致）。 */}
      {bookCards.length > 0 && (
        <section className="book-section">
          <div className="cat-section-head">
            <h2 className="section-title">书籍更新</h2>
            <Link to="/novels" className="more-link">
              全部书籍<span className="more-arrow">›</span>
            </Link>
          </div>
          <div className="book-grid">
            {bookCards.map((a) => {
              const novel = a.novel;
              const chapters = (novel?.chapters || []).slice().sort((x, y) => x.order - y.order);
              const latestCh = chapters[chapters.length - 1]; // 不用 .at(-1)：tsconfig 的 lib 只到 ES2020
              const statusMeta = novel?.status ? NOVEL_STATUS_META[novel.status] : null;
              return (
                <Link key={a.id} to={`/article/${a.id}`} className="book-card">
                  {novel?.cover ? (
                    <img src={novel.cover} alt={a.title} className="book-cover" loading="lazy" />
                  ) : (
                    <span className="book-cover book-cover-ph" aria-hidden="true">{a.title.slice(0, 1)}</span>
                  )}
                  <div className="book-body">
                    <h3 className="book-title">{a.title}</h3>
                    <div className="book-meta">
                      {statusMeta && (
                        <span
                          className="book-status"
                          style={{ '--chip-color': statusMeta.color, '--chip-ink': statusMeta.ink } as CSSProperties}
                        >
                          {statusMeta.label}
                        </span>
                      )}
                      <span className="book-meta-text">
                        共 {chapters.length} 章{novel?.wordCount ? ` · ${novel.wordCount} 字` : ''}
                      </span>
                    </div>
                    {latestCh && (
                      <p className="book-latest">
                        <span className="book-latest-tag">最新</span>
                        <span className="book-latest-text">
                          {latestCh.part ? `${latestCh.part} · ` : ''}{latestCh.title}
                        </span>
                        <span className="book-arrow" aria-hidden="true">阅读 ›</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== 分类浏览 =====
          替代删掉的 5 个分类分区：每块压该分类的凉风凉色卡色（左竖条 + 淡底），
          手机端也能一眼点进分类（顶栏彩点在 ≤1199 就藏了）。
          2026-09-20 用户要求「底下的分类变成一行」+「现在这个太大了，换小一点」：
          恒定 5 列一行（不再 auto-fill），卡片整体缩小一档；手机端横滑仍是一行。 */}
      <section className="cat-nav-section">
        <h2 className="section-title">分类浏览</h2>
        <div className="cat-nav-grid">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const count = getByCategory(c).length;
            return (
              <Link
                key={c}
                to={`/category/${c}`}
                className="cat-nav-card"
                style={{ '--sec-color': meta.color, '--sec-ink': meta.ink } as CSSProperties}
              >
                <span className="cat-nav-name">{meta.label}</span>
                <span className="cat-nav-count">{count} 篇</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
