import { useMemo } from 'react';
import { useArticles } from '../context/ArticleContext';
import NovelCard from '../components/NovelCard';

export default function Novels() {
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
      <div className="cat-header" style={{ background: 'linear-gradient(135deg, #2F6B4F, #4A9BB8)' }}>
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