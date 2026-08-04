import { ReactNode } from 'react';
import { Article, Category } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ArticleContext, initialArticles, uid, storageKey } from './ArticleContext';

export function ArticleProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useLocalStorage<Article[]>(storageKey, initialArticles);

  const addArticle = (a: Article) => setArticles((prev) => [{ ...a, id: a.id || uid() }, ...prev]);

  const updateArticle = (a: Article) =>
    setArticles((prev) => prev.map((x) => (x.id === a.id ? a : x)));

  const deleteArticle = (id: string) => setArticles((prev) => prev.filter((x) => x.id !== id));

  const toggleFavorite = (id: string) =>
    setArticles((prev) =>
      prev.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x))
    );

  const togglePinned = (id: string) =>
    setArticles((prev) => prev.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));

  const getByCategory = (c: Category) =>
    articles.filter((a) => a.category === c).sort((a, b) => b.date.localeCompare(a.date));

  const getById = (id: string) => articles.find((a) => a.id === id);

  return (
    <ArticleContext.Provider
      value={{ articles, addArticle, updateArticle, deleteArticle, toggleFavorite, togglePinned, getByCategory, getById }}
    >
      {children}
    </ArticleContext.Provider>
  );
}
