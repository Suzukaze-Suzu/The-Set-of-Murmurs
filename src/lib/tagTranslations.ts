// ============================================================================
// 呓语集 · 标签翻译词典（P5，2026-09-21）
// ----------------------------------------------------------------------------
// Saber 的指令：「支持标签翻译」。此前英文线的标签（文章卡片 / 正文页的 `#标签`）
// 一直原样显示中文，这是「待裁决」清单里的一条——现在翻。
//
// 为什么是**全局词典**而不是「每篇文章各存一份」：
//   标签是跨文章复用的自由文本，全站 31 个标签里「数学分析 / 百合 / 情感」这类
//   会出现在多篇上。以**中文标签为主键**，一个词只翻一次、处处生效；
//   逐篇存＝同一个词要翻好几遍，改一次还得改好几处。
//
// 回退口径 = 他 2026-09-21 选的 A 案：**缺译就显示中文标签，不加任何标记**
//   （与正文段落同待遇，英文页读起来不断裂、读者感知最小）。
//
// 两条纪律（与 lib/translations.ts 一致）：
//   ① 中文线（locale='zh'）一个请求都不发；
//   ② 表不存在 / 请求失败一律**静默降级**成「没有词典」，英文页显示中文标签，
//      绝不因为一张表把页面搞崩。
//
// 表结构见 blog/docs/sql/2026-09-21-p5-tag-translations.sql。
// RLS：reviewed 且非空对所有人可读，draft 只有博主能读，写只有博主。
// ============================================================================

import { supabase } from './supabase';
import type { Locale } from '../i18n';
import type { TranslationStatus, SaveResult } from './translations';

export interface TagTranslation {
  /** 中文标签原文（就是 articles.tags 里那一串），也是主键 */
  tag: string;
  locale: Locale;
  /** 英文；''＝还没翻 */
  translation: string;
  status: TranslationStatus;
  updatedAt: string;
}

/** 展示用词典：中文标签 → 英文标签 */
export type TagMap = Record<string, string>;

let warnedMissingTable = false;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = error.message || '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    (/tag_translations/.test(msg) && /schema cache|does not exist/i.test(msg))
  );
}

function warnOnce(error: { message?: string }) {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.warn(
    '[i18n] 读不到 tag_translations（英文页的标签暂时显示中文）。' +
      '建表 SQL 见 blog/docs/sql/2026-09-21-p5-tag-translations.sql：' +
      (error.message || ''),
  );
}

function missingTableHint(error: { code?: string; message?: string } | null): string {
  return isMissingTable(error)
    ? '\n\n数据库里还没有标签词典表：请在 Supabase 执行 blog/docs/sql/2026-09-21-p5-tag-translations.sql'
    : '';
}

/** 把行列表折成「中文标签 → 英文」的词典（空译文与未审校的都不要） */
export function tagMapFrom(list: TagTranslation[]): TagMap {
  const map: TagMap = {};
  for (const t of list) {
    const en = (t.translation || '').trim();
    if (t.status === 'reviewed' && en) map[t.tag] = en;
  }
  return map;
}

/** 用词典把一个标签换英文（没有就原样返回中文） */
export function translateTag(tag: string, map: TagMap | null | undefined): string {
  return (map && map[tag]) || tag;
}

/**
 * 公开页用：只要已审校的（RLS 已经拦了一道，这里再按状态与空串过一遍）。
 * 表不存在时返回 {}。
 */
export async function fetchReviewedTagTranslations(locale: Locale = 'en'): Promise<TagMap> {
  const { data, error } = await supabase
    .from('tag_translations')
    .select('*')
    .eq('locale', locale)
    .eq('status', 'reviewed');
  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    else console.warn('[i18n] 读取标签词典失败：', error.message);
    return {};
  }
  return tagMapFrom((data || []).map(rowToTag));
}

/** 工作台 / 词典编辑区用：连草稿一起读（RLS 保证 anon 只能拿到 reviewed） */
export async function fetchAllTagTranslations(locale: Locale = 'en'): Promise<TagTranslation[]> {
  const { data, error } = await supabase.from('tag_translations').select('*').eq('locale', locale);
  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    else console.warn('[i18n] 读取标签词典失败：', error.message);
    return [];
  }
  return (data || []).map(rowToTag);
}

function rowToTag(row: Record<string, unknown>): TagTranslation {
  return {
    tag: String(row.tag ?? ''),
    locale: (row.locale === 'en' ? 'en' : 'zh') as Locale,
    translation: String(row.translation ?? ''),
    status: row.status === 'reviewed' ? 'reviewed' : 'draft',
    updatedAt: String(row.updated_at ?? ''),
  };
}

/**
 * 保存一个标签的译文。译文清空＝删掉这一行（英文页回到中文标签）。
 * 不做并发检查：一个标签一个输入框，冲突的代价只是把最后一次输入写丢，
 * 而且这条路径上「后写覆盖前写」正是他想要的直觉。
 */
export async function saveTagTranslation(
  tag: string,
  locale: Locale,
  t: { translation: string; status: TranslationStatus },
): Promise<SaveResult> {
  const translation = t.translation.trim();
  if (!translation) return deleteTagTranslation(tag, locale);

  const { data, error } = await supabase
    .from('tag_translations')
    .upsert(
      { tag, locale, translation, status: t.status },
      { onConflict: 'tag,locale' },
    )
    .select('updated_at')
    .single();

  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    return { error: error.message + missingTableHint(error) };
  }
  return { error: null, updatedAt: String(data?.updated_at ?? '') };
}

/** 删除一个标签的译文（英文页退回显示中文标签） */
export async function deleteTagTranslation(tag: string, locale: Locale = 'en') {
  const { error } = await supabase
    .from('tag_translations')
    .delete()
    .eq('tag', tag)
    .eq('locale', locale);
  if (error && isMissingTable(error)) warnOnce(error);
  return { error: error ? error.message : null };
}
