import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import NovelCard from '../components/NovelCard';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Novels() {
  usePageTitle('小说书架');
  const { articles } = useArticles();

  const novels = useMemo(
    () =>
      articles
        .filter((a) => a.category === 'reading' && a.novel?.chapters?.length)
        .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1)),
    [articles]
  );

  const totalChapters = novels.reduce((s, a) => s + (a.novel?.chapters?.length || 0), 0);

  return (
    <div className="page">
      {/* 配色跟随 CATEGORY_META.reading（蜜金）：原来的墨绿 #2F6B4F 不在凉风凉四色里，已弃用 */}
      <div className="cat-header" style={{ '--cat-tint': '#E8C9A0', '--cat-accent': '#8F6220' } as CSSProperties}>
        <h1 className="page-title light">小说书架</h1>
        <p className="cat-count">共 {novels.length} 本 · {totalChapters} 章</p>
      </div>

      {novels.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-ghost" />
          <p>书架还是空的，快去写作页连载第一篇小说吧</p>
        </div>
      ) : (
        <div className="novel-grid">
          {novels.map((a) => (
            <NovelCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}