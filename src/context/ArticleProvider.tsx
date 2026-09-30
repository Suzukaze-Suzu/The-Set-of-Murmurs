import { ReactNode, useEffect, useState } from 'react';
import { Article, Category } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { ArticleContext, uid } from './ArticleContext';
import { rowToArticle } from '../lib/articleRow';

// 预渲染注入的文章数据（scripts/prerender.mjs 写入 window.__PRERENDERED_ARTICLE__）
function getPrerenderedArticle(): Article | null {
  try {
    if (typeof window === 'undefined') return null;
    const data = (window as any).__PRERENDERED_ARTICLE__;
    if (data && typeof data === 'object' && data.id) return data as Article;
  } catch { /* ignore */ }
  return null;
}

export function ArticleProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  // 预渲染页面：用注入的文章作为首屏数据，避免二次请求 Supabase
  const prerendered = getPrerenderedArticle();
  const [articles, setArticlesState] = useState<Article[]>(prerendered ? [prerendered] : []);
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
        novel: article.novel ? JSON.stringify(article.novel) : null,
      })
      .then(({ error }) => {
        if (error) {
          console.error('文章发布失败：', error);
          alert('发布失败：' + error.message + (/column|novel|relation/i.test(error.message || '') ? '\n\n数据库 articles 表可能缺少 novel 列，请在 Supabase 执行：\nALTER TABLE articles ADD COLUMN IF NOT EXISTS novel jsonb;' : ''));
          return;
        }
        refresh();
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
        novel: a.novel ? JSON.stringify(a.novel) : null,
      })
      .eq('id', a.id)
      .then(({ error }) => {
        if (error) {
          console.error('文章更新失败：', error);
          alert('更新失败：' + error.message);
          return;
        }
        refresh();
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
