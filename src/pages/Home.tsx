import { useArticles } from '../context/ArticleContext';
import { useProfile } from '../context/ProfileContext';
import { CATEGORIES, CATEGORY_META, Category } from '../types';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';

interface Props {
  query: string;
}

export default function Home({ query }: Props) {
  usePageTitle();
  const { articles, getByCategory } = useArticles();
  const { isAdmin } = useAuth();
  const { profile } = useProfile();

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

      {query && (
        <section className="search-banner">
          <p>搜索 “<strong>{query}</strong>” 的结果，共 {articles.length} 篇匹配文章</p>
        </section>
      )}

      {/* 收藏/置顶区 */}
      {!query && (
        <section className="featured-section">
          <h2 className="section-title">置顶与收藏</h2>
          <div className="card-grid">
            {articles
              .filter((a) => a.pinned || a.favorite)
              .slice(0, 4)
              .map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
          </div>
        </section>
      )}

      {/* 按分类分区展示 */}
      <div className="category-sections">
        {CATEGORIES.map((c: Category) => {
          const catArticles = query
            ? getByCategory(c).filter((a) =>
                (a.title + ' ' + a.content + ' ' + (a.summary || '') + ' ' + a.tags.join(' '))
                  .toLowerCase()
                  .includes(query.toLowerCase())
              )
            : getByCategory(c);
          const meta = CATEGORY_META[c];
          if (catArticles.length === 0) return null;
          return (
            <section key={c} className="cat-section">
              <div className="cat-section-head">
                {/* 第2h步：分区小标题只把「该分类的墨色」当 CSS 变量传下去，字色由 index.css 定，
                    暗色主题才能把它统一改成白色（写死 inline color 会压住暗色规则）。
                    「更多」链接保持分类色，不算标题。 */}
                <h2 className="section-title" style={{ '--sec-ink': meta.ink } as CSSProperties}>
                  {meta.label}
                </h2>
                <Link to={`/category/${c}`} className="more-link" style={{ color: meta.ink }}>
                  更多<span className="more-arrow">›</span>
                </Link>
              </div>
              <div className="card-grid">
                {catArticles.slice(0, query ? 50 : 3).map((a) =>
                  a.novel?.chapters?.length ? (
                    <NovelCard key={a.id} article={a} />
                  ) : (
                    <ArticleCard key={a.id} article={a} />
                  )
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

