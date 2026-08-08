import { useArticles } from '../context/ArticleContext';
import { useProfile } from '../context/ProfileContext';
import { CATEGORIES, CATEGORY_META, Category } from '../types';
import { Link } from 'react-router-dom';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { useAuth } from '../context/AuthContext';

interface Props {
  query: string;
}

export default function Home({ query }: Props) {
  const { articles, getByCategory } = useArticles();
  const { isAdmin } = useAuth();
  const { profile } = useProfile();

  return (
    <div className="page home">
      {/* 头部横幅 */}
      <section className="hero" style={{ background: 'linear-gradient(135deg, var(--sky-blue), var(--honey-gold))' }}>
        <div className="hero-inner">
          <h1 className="hero-title">呓语集</h1>
          <p className="hero-sub">{profile.signature}</p>
          <p className="hero-desc">{profile.intro}</p>
          <div className="hero-cta">
            {isAdmin && <Link to="/write" className="btn btn-light">开始写作</Link>}
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
                <h2 className="section-title" style={{ color: meta.color }}>
                  {meta.label}
                </h2>
                <Link to={`/category/${c}`} className="more-link" style={{ color: meta.color }}>
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

