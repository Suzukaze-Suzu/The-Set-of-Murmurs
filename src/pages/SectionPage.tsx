import { useParams, Link } from 'react-router-dom';
import { useMemo, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORY_META, Category } from '../types';
import N1Entry from '../components/n1/N1Entry';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { useT } from '../i18n';
import { catKey } from '../i18n/dict';

const PAGE_SIZE = 12;

/* ══════════════════════════════════════════════════════════════════════════════
   分类页（2026-10-09 迁入 N1）
   ──────────────────────────────────────────────────────────────────────────────
   与 /articles 同族（用户裁决「三页一起做」）：页头用样张 `.pagehead`，分类色只当
   `.kicker` 上那枚小方块与条目 `.cat::before` 的方块（色号仍取 `CATEGORY_META`，一个没换），
   列表同样走三栏纯文字流 `.list`/`.item`。
   **逻辑一行没动**：非法分类静默回退 `anime`（照旧）、按日期倒序、无限滚动、i18n、
   博主可见的「去写一篇」空态入口、切分类时 `window.scrollTo(0,0)`。
   回退＝`git checkout -- src/pages/SectionPage.tsx` ＋ 从 `n1Routes.ts` 删掉 `/category` 一条。
   ══════════════════════════════════════════════════════════════════════════════ */
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
    <>
      <section className="pagehead" style={{ '--c': meta.color } as CSSProperties}>
        <div className="pagehead-txt">
          <div className="kicker">
            <Link to="/articles" className="kick-back">{t('article.backToAll')}</Link>
          </div>
          <h1>{t(catKey(cat))}</h1>
          <p className="lede">{t('count.posts', { n: list.length })}</p>
        </div>
      </section>

      <section className="sec">
        {list.length === 0 ? (
          <p className="gnote">
            {t('article.noneInCategory')}
            {isAdmin && <Link to="/write" className="btn">{t('article.writeOne')}</Link>}
          </p>
        ) : (
          <>
            <div className="list list-archive">
              {visible.map((a) => (
                <N1Entry key={a.id} article={a} />
              ))}
            </div>
            {hasMore ? (
              <div ref={sentinelRef} className="gnote list-loading">{t('count.loadingMore')}</div>
            ) : (
              <p className="gnote list-end">{t('count.allLoaded', { n: total })}</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
