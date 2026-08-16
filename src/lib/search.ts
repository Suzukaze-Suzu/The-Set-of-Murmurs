import { supabase } from './supabase';
import { rowToArticle } from './articleRow';
import type { Article } from '../types';

// 转义 LIKE 通配符，避免用户输入 % _ 干扰查询
function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => '\\' + m);
}

// 数据库全文搜索：匹配 标题/摘要/正文。
// 加速依赖 supabase/search-index.sql 里的 pg_trgm 索引（需在 Supabase SQL Editor 执行一次）。
export async function searchArticles(query: string): Promise<Article[]> {
  const q = query.trim();
  if (!q) return [];
  const esc = escapeLike(q);
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .or(`title.ilike.%${esc}%,summary.ilike.%${esc}%,content.ilike.%${esc}%`)
    .order('pinned', { ascending: false })
    .order('date', { ascending: false });
  if (error) {
    console.error('全文搜索失败：', error);
    return [];
  }
  return (data || []).map(rowToArticle);
}
