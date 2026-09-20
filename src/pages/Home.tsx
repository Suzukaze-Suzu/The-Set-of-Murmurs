import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, CATEGORY_META } from '../types';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { usePageTitle } from '../hooks/usePageTitle';

interface Props {
  query: string;
}

/* 2026-09-20 首页改版（用户要求，方案用户已逐条审批：版本 2 / 最新区形态 D / 不去重 / 彩点换序 / 分类分区隐藏）
   本页最终结构＝hero → 最新更新 → 置顶与收藏 → 分类浏览（5 色块导航）。
   分类分区整段删掉：分类改从顶栏彩点（.nav-cats）和 /articles 的筛选按钮进，
   底部再补一排「分类浏览」色块把手机端的入口还回来（顶栏彩点在手机上收进汉堡菜单）。
   回滚＝把本文件换回 blog\first\home-layout-v1\Home.改动前.tsx。 */
export default function Home({ query }: Props) {
  usePageTitle();
  const { articles, getByCategory, toggleFavorite } = useArticles();
  const { isAdmin } = useAuth();
  const { profile } = useProfile();

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

  /* 搜索兜底：原来首页自己按分类过滤并显示搜索结果，现在分类分区没了，
     有搜索词就把人送到 /articles（那边有数据库全文搜索 + 滚动加载，逻辑更完整）。 */
  if (query.trim()) {
    return (
      <div className="page home">
        <section className="search-banner">
          <p>
            首页不再按分类展示，正在为你跳转到「全部文章」搜索 “<strong>{query}</strong>”…
          </p>
          <Link to="/articles" className="btn btn-primary">立即前往搜索结果</Link>
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

      {/* ===== 分类浏览 =====
          替代删掉的 5 个分类分区：每块压该分类的凉风凉色卡色（左竖条 + 淡底），
          手机端也能一眼点进分类（顶栏彩点在 ≤1199 就藏了）。 */}
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
                style={{ '--sec-color': meta.color } as CSSProperties}
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
