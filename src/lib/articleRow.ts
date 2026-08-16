import { Article } from '../types';

// Supabase 行 → 前端 Article 对象（articleRow 转换，供全量加载与搜索共用）
export function rowToArticle(row: any): Article {
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
    attachments: Array.isArray(row.attachments)
      ? row.attachments
      : typeof row.attachments === 'string'
        ? JSON.parse(row.attachments)
        : [],
    novel: row.novel ? (typeof row.novel === 'string' ? JSON.parse(row.novel) : row.novel) : undefined,
  };
}
