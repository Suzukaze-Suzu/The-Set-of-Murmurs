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

/**
 * ★ 2026-10-11「打开显示 0 篇文章」★
 * 构建期预渲染时，每个静态页都带一份**文章列表快照**（`window.__PRERENDERED_ARTICLES__`，
 * 见 scripts/prerender.mjs 的 articlesPayloadScript）。
 *
 * 改前的问题：`select('*')` 一旦失败（墙内 SNI 重置、断网、热点——实测都能触发），
 * provider 什么都不做 → `articles` 停在 `[]`，而 React 已经把预渲染块整个换掉，
 * 于是「构建期明明抓到了 12 篇」的页面变成 0 篇：首页统计条「0 篇文章 / 0 本书」、
 * 分类计数全 0、置顶区空。有这份快照，取数不通时页面仍显示**上一次构建时的真实内容**。
 * 线上取数成功时一切照旧（以线上为准，见下面的 useEffect）。
 */
function getPrerenderedArticles(): Article[] {
  try {
    if (typeof window === 'undefined') return [];
    const rows = (window as any).__PRERENDERED_ARTICLES__;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => r && typeof r === 'object' && r.id)
      .map((r) => rowToArticle(r as Record<string, unknown>));
  } catch { /* ignore */ }
  return [];
}

export function ArticleProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  // 预渲染页面：用注入的文章作为首屏数据，避免二次请求 Supabase
  const prerendered = getPrerenderedArticle();
  // 列表快照（离线兜底）：详情页注入的是整篇、列表页注入的是整份列表，两者互不冲突
  const snapshot = getPrerenderedArticles();
  const [articles, setArticlesState] = useState<Article[]>(
    () => (snapshot.length ? snapshot : prerendered ? [prerendered] : []),
  );
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
        if (!error && data && data.length) {
          // 成功：以线上为准
          setArticlesState(data.map(rowToArticle));
        }
        /* 失败（或返回空）：**保留手上的数据**——可能是 ctx.prerender 注入的快照，
           也可能是上一次成功拉取的结果。改前这里是「静默清空成 []」。 */
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
      value={{ articles, loaded, addArticle, updateArticle, deleteArticle, toggleFavorite, togglePinned, getByCategory, getById }}
    >
      {children}
    </ArticleContext.Provider>
  );
}
