import { supabase } from './supabase';
import { rowToArticle } from './articleRow';
import type { Article } from '../types';

// 转义 LIKE 通配符，避免用户输入 % _ 干扰查询
function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => '\\' + m);
}

/**
 * 数据库全文搜索：匹配 标题/摘要/正文。
 * locale 可选——英文站时先查译文表拿到命中 id，再并上中文命中
 * （未翻译的文章也能被搜到）。译文表缺失/报错退化成纯中文搜索。
 */
export async function searchArticles(query: string, locale?: string): Promise<Article[]> {
  const q = query.trim();
  if (!q) return [];
  const esc = escapeLike(q);

  // 始终搜中文表（未翻译的文章也该能被搜到）
  const { data: zhData, error: zhError } = await supabase
    .from('articles')
    .select('*')
    .or(`title.ilike.%${esc}%,summary.ilike.%${esc}%,content.ilike.%${esc}%`);

  if (zhError) {
    console.error('全文搜索失败：', zhError);
    return [];
  }

  const zhArticles = (zhData || []).map(rowToArticle);
  if (locale !== 'en') return zhArticles;

  // 英文站：额外搜译文表，拿到中文表没命中的英文命中
  const { data: trData, error: trError } = await supabase
    .from('article_translations')
    .select('article_id')
    .eq('status', 'reviewed')
    .eq('locale', 'en')
    .or(`title.ilike.%${esc}%,summary.ilike.%${esc}%,content.ilike.%${esc}%`);

  if (trError || !trData || trData.length === 0) {
    return zhArticles; // 译文表异常退化成纯中文搜索
  }

  const existingIds = new Set(zhArticles.map((a) => a.id));
  const missingIds = trData.map((r) => r.article_id).filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) return zhArticles;

  const { data: extraData, error: extraError } = await supabase
    .from('articles')
    .select('*')
    .in('id', missingIds);

  if (extraError || !extraData) return zhArticles;

  const merged = zhArticles.concat(extraData.map(rowToArticle));
  // 按 pinned desc / date desc 合序
  merged.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
  return merged;
}
