import { useParams, Link } from 'react-router-dom';
import { useMemo, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORY_META, Category } from '../types';
import ArticleCard from '../components/ArticleCard';
import NovelCard from '../components/NovelCard';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { useT } from '../i18n';
import { catKey } from '../i18n/dict';

const PAGE_SIZE = 12;

export default function SectionPage() {
  const { category } = useParams();
  const { articles } = useArticles();
  const { isAdmin } = useAuth();
  const t = useT();

  const cat = (category as Category) in CATEGORY_META ? (category as Category) : 'anime';
  const meta = CATEGORY_META[cat];
  usePageTitle(t(catKey(cat)));

  const list = useMemo(
    () => articles.filter((a) => a.category === cat).sort((a, b) => b.date.localeCompare(a.date)),
    [articles, cat]
  );

  const { visible, hasMore, total, sentinelRef } = useInfiniteList(list, PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category]);

  return (
    <div className="page">
      {/* 第2f步：左竖条是「颜色」，改用色卡色本身（原来用 ink 墨色） */}
      <div className="cat-header" style={{ '--cat-tint': meta.color, '--cat-accent': meta.color } as CSSProperties}>
        <Link to="/articles" className="back-link">{t('article.backToAll')}</Link>
        <h1 className="page-title light">
          {t(catKey(cat))}
        </h1>
        <p className="cat-count">{t('count.posts', { n: list.length })}</p>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-ghost" />
          <p>{t('article.noneInCategory')}</p>
          {isAdmin && <Link to="/write" className="btn btn-primary">{t('article.writeOne')}</Link>}
        </div>
      ) : (
        <>
          <div className="card-grid wide">
            {visible.map((a) =>
              a.novel?.chapters?.length ? (
                <NovelCard key={a.id} article={a} />
              ) : (
                <ArticleCard key={a.id} article={a} />
              )
            )}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="list-loading">{t('count.loadingMore')}</div>
          ) : (
            <p className="list-end">{t('count.allLoaded', { n: total })}</p>
          )}
        </>
      )}
    </div>
  );
}
