import { ReactNode, useEffect, useState } from 'react';
import { Article, Category } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { ArticleContext, uid } from './ArticleContext';

function rowToArticle(row: any): Article {
  return {
    id: row.id,
    title: row.title,
    content: row.content || '',
    category: row.category || 'essay',
    tags: row.tags || [],
    date: row.date,
    favorite: !!row.favorite,
    pinned: !!row.pinned,
    summary: row.summary || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : []),
  };
}

export function ArticleProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [articles, setArticlesState] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0); // 用于刷新

  const refresh = () => setVersion((v) => v + 1);

  // 从 Supabase 加载文章
  useEffect(() => {
    let mounted = true;
    supabase
      .from('articles')
      .select('*')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) {
          setArticlesState(data.map(rowToArticle));
        }
        setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [version]);

  const setArticles = (updater: (prev: Article[]) => Article[]) => {
    setArticlesState(updater);
  };

  const addArticle = (a: Article) => {
    if (!isAdmin) return;
    const article: Article = { ...a, id: a.id || uid() };
    supabase
      .from('articles')
      .insert({
        id: article.id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags,
        date: article.date,
        favorite: article.favorite,
        pinned: article.pinned,
        summary: article.summary || '',
        attachments: article.attachments || [],
      })
      .then(({ error }) => {
        if (!error) refresh();
      });
  };

  const updateArticle = (a: Article) => {
    if (!isAdmin) return;
    supabase
      .from('articles')
      .update({
        title: a.title,
        content: a.content,
        category: a.category,
        tags: a.tags,
        date: a.date,
        favorite: a.favorite,
        pinned: a.pinned,
        summary: a.summary || '',
        attachments: a.attachments || [],
      })
      .eq('id', a.id)
      .then(({ error }) => {
        if (!error) refresh();
      });
  };

  const deleteArticle = (id: string) => {
    if (!isAdmin) return;
    supabase
      .from('articles')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (!error) refresh();
      });
  };

  const toggleFavorite = (id: string) => {
    if (!isAdmin) return;
    const target = articles.find((a) => a.id === id);
    if (target) {
      supabase
        .from('articles')
        .update({ favorite: !target.favorite })
        .eq('id', id)
        .then(() => refresh());
    }
  };

  const togglePinned = (id: string) => {
    if (!isAdmin) return;
    const target = articles.find((a) => a.id === id);
    if (target) {
      supabase
        .from('articles')
        .update({ pinned: !target.pinned })
        .eq('id', id)
        .then(() => refresh());
    }
  };

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
