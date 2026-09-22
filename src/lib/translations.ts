// ============================================================================
// 呓语集 · 译文读写（翻译 v2，2026-09-21）
// ----------------------------------------------------------------------------
// 口径（Saber 定）：「全部翻译，但是翻译部分我自己来，或者说要让我能修改翻译成果」
//   → 不做机翻。英文正文由博主在写作页的「English」页签里自己写，
//     存进 article_translations（＋小说逐章的 article_translation_chapters），
//     标 reviewed 才对外上线。
//
// v2 相对 P3 的三个变化（都是「更新逻辑不好用」的正面回答）：
//   ① **段落级**：正文按 Markdown 切段（lib/segments.ts），每段独立译文、独立判状态；
//      非小说存 article_translations.segments，小说逐章存 chapters 表的 segments。
//   ② **原文版本**：保存时把中文原稿的哈希写进 source_hash / src_hash，
//      中文改过 → 工作台与总览显示「待复核」，段落级还能高亮到底改了哪几段。
//   ③ **逐章保存 + 并发检查**：小说改哪章写哪章（P3 是整本 jsonb 全量重写）；
//      保存前比对 updated_at，被别的窗口改过就报冲突而不是静默覆盖。
//
// 表结构见 blog/docs/sql/2026-09-21-p4-translation-v2.sql。
// RLS：reviewed 对所有人可读，draft 只有博主（登录态 admin）能读，写只有博主；
//      历史版本表 article_translation_versions 只有博主能读（触发器自动快照，留最近 30 版）。
//
// ⚠️ 「表还没建」时必须 **静默降级**：读不到就当没有译文、显示中文原文＋一行提示，
//    绝不因为一张表把整个英文站搞崩。
// ============================================================================

import { supabase } from './supabase';
import type { Locale } from '../i18n';
import type { Article, NovelChapter } from '../types';
// 只借类型：标签词典的读写都在 lib/tagTranslations.ts（P5 起）
import type { TagMap } from './tagTranslations';
import {
  AlignedSegment,
  TrSegment,
  alignSegments,
  mergeContent,
  splitSegments,
  hashText,
} from './segments';
import { countWords, type CountParts } from './wordCount';

/**
 * ★ 2026-09-22：把对齐后的段落切成「已译部分 / 中文回退部分」两侧分别统计。
 * 英文页的字数显示据此说话：两侧都有 → `447 words · 6,765 characters`。
 * （切分只认译文状态，不猜正文语言 —— 中文数学文章的公式段不会被算成 words。）
 */
function partsOfAligned(aligned: AlignedSegment[]): CountParts {
  const en: string[] = [];
  const zh: string[] = [];
  for (const a of aligned) (a.en.trim() ? en : zh).push(a.en.trim() ? a.en : a.zh);
  return { words: countWords(en.join('\n\n'), 'en'), chars: countWords(zh.join('\n\n'), 'zh') };
}

export type TranslationStatus = 'draft' | 'reviewed';

/** 单章译文（用章 id 与中文原章对齐） */
export interface TranslatedChapter {
  id: string;
  title: string;
  /** 整篇模式的正文（老数据 / 整段翻译时用；有 segments 时 segments 优先） */
  content: string;
  /** 段落级译文；null = 这段还没切过段（老数据） */
  segments: TrSegment[] | null;
  /** 保存时中文那一章的哈希 */
  srcHash: string;
  updatedAt: string;
}

export interface ArticleTranslation {
  articleId: string;
  locale: Locale;
  title: string;
  summary: string;
  /**
   * 非小说的整篇英文正文。渲染时**优先**看 segments（逐段回退中文），
   * 只有 segments 为空（老数据/整篇模式）才直接用这个。
   */
  content: string;
  segments: TrSegment[] | null;
  chapters: TranslatedChapter[] | null;
  status: TranslationStatus;
  /** 保存时中文原稿整体的哈希（'' = 老数据，不当成「待复核」） */
  sourceHash: string;
  updatedAt: string;
}

/** 新译文（还没落库）的编辑态默认值 */
export function emptyTranslation(articleId: string, locale: Locale): ArticleTranslation {
  return {
    articleId,
    locale,
    title: '',
    summary: '',
    content: '',
    segments: null,
    chapters: null,
    status: 'draft',
    sourceHash: '',
    updatedAt: '',
  };
}

// ---------------------------------------------------------------------------
// 原文哈希
// ---------------------------------------------------------------------------

/**
 * 中文原稿的整体哈希（标题＋正文＋小说简介与全部章节）。
 * 为什么不用时间戳：articles 表**没有 updated_at**，加列要动全站写入路径；
 * 内容哈希还更准——改回原样就等于没改。
 * ⚠️ 刻意**不含 article.summary**：普通文章的摘要是由正文自动截出来的，
 *    单独入哈希会在中文没变时抖出假的「待复核」。
 */
export function articleSourceHash(article: Article): string {
  const parts = [
    article.title || '',
    article.content || '',
    article.novel?.synopsis || '',
  ];
  for (const ch of article.novel?.chapters || []) {
    parts.push(ch.id || '', ch.title || '', ch.content || '');
  }
  return hashText(parts.join('\u0000'));
}

/** 单独一章的哈希（逐章判「待复核」） */
export function chapterSourceHash(ch: NovelChapter): string {
  return hashText([ch.id || '', ch.title || '', ch.content || ''].join('\u0000'));
}

// ---------------------------------------------------------------------------
// 读
// ---------------------------------------------------------------------------

let warnedMissingTable = false;

/** 表不存在（PGRST205 / 42P01）时的统一降级日志——只吵一次，不刷屏 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = error.message || '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /(article_translations|article_translation_)/.test(msg) && /schema cache|does not exist/i.test(msg)
  );
}

function warnOnce(error: { message?: string }) {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.warn(
    '[i18n] 读不到 article_translations（英文译文暂时按“未翻译”处理，页面显示中文原文）。' +
      '建表 / 升级 SQL 见 blog/docs/sql/2026-09-21-p4-translation-v2.sql：' +
      (error.message || ''),
  );
}

/** jsonb → TrSegment[]（形状不对就当没有，别让脏数据把页面搞崩） */
function toTrSegments(raw: unknown): TrSegment[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: TrSegment[] = [];
  raw.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const o = r as Record<string, unknown>;
    const en = String(o.en ?? '');
    const id = String(o.id ?? o.srcHash ?? '');
    if (!id) return;
    out.push({
      id,
      srcHash: String(o.srcHash ?? id),
      en,
      i: typeof o.i === 'number' ? o.i : i,
    });
  });
  return out.length ? out : null;
}

function rowToTranslation(row: Record<string, unknown>): ArticleTranslation {
  return {
    articleId: String(row.article_id ?? ''),
    locale: (row.locale === 'en' ? 'en' : 'zh') as Locale,
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    content: String(row.content ?? ''),
    segments: toTrSegments(row.segments),
    chapters: null,
    status: row.status === 'reviewed' ? 'reviewed' : 'draft',
    sourceHash: String(row.source_hash ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function rowToChapter(row: Record<string, unknown>): TranslatedChapter {
  return {
    id: String(row.chapter_id ?? ''),
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    segments: toTrSegments(row.segments),
    srcHash: String(row.src_hash ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/** 把 P3 留在 article_translations.chapters（整本 jsonb）里的老译文读出来，只当兜底 */
function legacyChapters(row: Record<string, unknown>): TranslatedChapter[] | null {
  const raw = row.chapters;
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: TranslatedChapter[] = [];
  raw.forEach((c) => {
    if (!c || typeof c !== 'object') return;
    const o = c as Record<string, unknown>;
    const id = String(o.id ?? '');
    if (!id) return;
    out.push({
      id,
      title: String(o.title ?? ''),
      content: String(o.content ?? ''),
      segments: null,
      srcHash: '',
      updatedAt: '',
    });
  });
  return out.length ? out : null;
}

/** 读一篇文章的逐章译文（草稿也读得到——只有博主登录态能走到这里） */
async function fetchChapterRows(
  articleId: string,
  locale: Locale,
): Promise<TranslatedChapter[] | null> {
  const { data, error } = await supabase
    .from('article_translation_chapters')
    .select('*')
    .eq('article_id', articleId)
    .eq('locale', locale);
  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    else console.warn('[i18n] 读取逐章译文失败：', error.message);
    return null;
  }
  const list = (data || []).map(rowToChapter);
  return list.length ? list : null;
}

/** 读一篇文章的译文（工作台用：博主登录态下连草稿一起读） */
export async function fetchArticleTranslation(
  articleId: string,
  locale: Locale = 'en',
): Promise<ArticleTranslation | null> {
  const [{ data, error }, chapters] = await Promise.all([
    supabase
      .from('article_translations')
      .select('*')
      .eq('article_id', articleId)
      .eq('locale', locale)
      .maybeSingle(),
    fetchChapterRows(articleId, locale),
  ]);
  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    else console.warn('[i18n] 读取译文失败：', error.message);
    return chapters && chapters.length ? { ...emptyTranslation(articleId, locale), chapters } : null;
  }
  if (!data && !chapters) return null;
  if (!data) return { ...emptyTranslation(articleId, locale), chapters };
  const tr = rowToTranslation(data);
  tr.chapters = chapters || legacyChapters(data);
  return tr;
}

/**
 * 读译文列表：onlyReviewed=true 走公开页（anon 只可能拿到 reviewed），
 * false 走「翻译进度」总览（博主登录态下连草稿一起看；anon 走到这里只会拿到 reviewed）。
 * 两次查询：文章级一次、逐章一次，然后在内存里合并（逐章表没有到译文表的外键，
 * 取不到嵌套 select）。公开路径上**只保留 reviewed 文章的章**——博主登录时
 * chapters 的 RLS 会把草稿章也放出来，所以这里必须自己按文章状态过滤。
 */
async function fetchTranslations(locale: Locale, onlyReviewed: boolean): Promise<ArticleTranslation[]> {
  let q = supabase.from('article_translations').select('*').eq('locale', locale);
  if (onlyReviewed) q = q.eq('status', 'reviewed');
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    else console.warn('[i18n] 读取译文列表失败：', error.message);
    return [];
  }
  const list = (data || []).map(rowToTranslation);
  const rawById = new Map<string, Record<string, unknown>>();
  for (const r of data || []) {
    const row = r as Record<string, unknown>;
    rawById.set(String(row.article_id ?? ''), row);
  }

  const { data: chData, error: chErr } = await supabase
    .from('article_translation_chapters')
    .select('*')
    .eq('locale', locale);
  if (chErr) {
    if (!isMissingTable(chErr)) console.warn('[i18n] 读取逐章译文失败：', chErr.message);
  } else {
    const byArticle = new Map<string, TranslatedChapter[]>();
    for (const row of chData || []) {
      const id = String(row.article_id ?? '');
      const arr = byArticle.get(id) || [];
      arr.push(rowToChapter(row));
      byArticle.set(id, arr);
    }
    for (const tr of list) tr.chapters = byArticle.get(tr.articleId) || null;
  }

  // 老数据兜底：P3 把整本塞在 article_translations.chapters 里的，读出来补上
  for (const tr of list) {
    if (tr.chapters) continue;
    const raw = rawById.get(tr.articleId);
    if (raw) tr.chapters = legacyChapters(raw);
  }
  return list;
}

/** 公开页用：只要已审校的 */
export function fetchReviewedTranslations(locale: Locale = 'en'): Promise<ArticleTranslation[]> {
  return fetchTranslations(locale, true);
}

/** 翻译进度总览用：连草稿一起（RLS 保证 anon 拿不到草稿） */
export function fetchAllTranslations(locale: Locale = 'en'): Promise<ArticleTranslation[]> {
  return fetchTranslations(locale, false);
}

// ---------------------------------------------------------------------------
// 写（含并发检查）
// ---------------------------------------------------------------------------

export interface SaveResult {
  error: string | null;
  /** 库里的版本比手里这份新 → 本次**没有**写，让用户选 */
  conflict?: { remoteUpdatedAt: string };
  /** 保存后数据库盖的新时间戳（客户端留着做下一次并发检查） */
  updatedAt?: string;
}

function missingTableHint(error: { code?: string; message?: string } | null): string {
  return isMissingTable(error)
    ? '\n\n数据库里还没有翻译 v2 的表：请在 Supabase 执行 blog/docs/sql/2026-09-21-p4-translation-v2.sql'
    : '';
}

/**
 * 保存「文章级」译文：标题、摘要、非小说正文（段落）、状态、原文哈希。
 * expectUpdatedAt：进工作台时读到的 updated_at。库里更新过就不写，返回 conflict。
 */
export async function saveArticleTranslation(
  tr: ArticleTranslation,
  expectUpdatedAt?: string,
): Promise<SaveResult> {
  if (expectUpdatedAt) {
    const { data, error } = await supabase
      .from('article_translations')
      .select('updated_at')
      .eq('article_id', tr.articleId)
      .eq('locale', tr.locale)
      .maybeSingle();
    if (!error && data?.updated_at && String(data.updated_at) !== expectUpdatedAt) {
      return { error: null, conflict: { remoteUpdatedAt: String(data.updated_at) } };
    }
  }

  const { data, error } = await supabase
    .from('article_translations')
    .upsert(
      {
        article_id: tr.articleId,
        locale: tr.locale,
        title: tr.title,
        summary: tr.summary,
        content: tr.content,
        segments: tr.segments && tr.segments.length ? tr.segments : null,
        status: tr.status,
        source_hash: tr.sourceHash,
      },
      { onConflict: 'article_id,locale' },
    )
    .select('updated_at')
    .single();

  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    return { error: error.message + missingTableHint(error) };
  }
  return { error: null, updatedAt: String(data?.updated_at ?? '') };
}

/**
 * 保存**一章**译文（小说逐章）。改哪章写哪章——这是 v2 相对 P3 的关键改进：
 * P3 每存一次都把整本书的 chapters jsonb 重写一遍，多窗口并行会静默互相覆盖。
 */
export async function saveChapterTranslation(
  articleId: string,
  locale: Locale,
  ch: TranslatedChapter,
  opts: { expectUpdatedAt?: string } = {},
): Promise<SaveResult> {
  if (opts.expectUpdatedAt) {
    const { data, error } = await supabase
      .from('article_translation_chapters')
      .select('updated_at')
      .eq('article_id', articleId)
      .eq('locale', locale)
      .eq('chapter_id', ch.id)
      .maybeSingle();
    if (!error && data?.updated_at && String(data.updated_at) !== opts.expectUpdatedAt) {
      return { error: null, conflict: { remoteUpdatedAt: String(data.updated_at) } };
    }
  }

  const { data, error } = await supabase
    .from('article_translation_chapters')
    .upsert(
      {
        article_id: articleId,
        locale,
        chapter_id: ch.id,
        title: ch.title,
        content: ch.content,
        segments: ch.segments && ch.segments.length ? ch.segments : null,
        src_hash: ch.srcHash,
      },
      { onConflict: 'article_id,locale,chapter_id' },
    )
    .select('updated_at')
    .single();

  if (error) {
    if (isMissingTable(error)) warnOnce(error);
    return { error: error.message + missingTableHint(error) };
  }
  return { error: null, updatedAt: String(data?.updated_at ?? '') };
}

/** 删除整篇译文（文章级 + 全部逐章） */
export async function deleteArticleTranslation(articleId: string, locale: Locale = 'en') {
  const [a, b] = await Promise.all([
    supabase.from('article_translations').delete().eq('article_id', articleId).eq('locale', locale),
    supabase
      .from('article_translation_chapters')
      .delete()
      .eq('article_id', articleId)
      .eq('locale', locale),
  ]);
  const err = a.error || b.error;
  if (err && isMissingTable(err)) warnOnce(err);
  return { error: err ? err.message : null };
}

/** 删除某一章的译文（英文页退回该章中文原文） */
export async function deleteChapterTranslation(
  articleId: string,
  locale: Locale,
  chapterId: string,
) {
  const { error } = await supabase
    .from('article_translation_chapters')
    .delete()
    .eq('article_id', articleId)
    .eq('locale', locale)
    .eq('chapter_id', chapterId);
  return { error: error ? error.message : null };
}

// ---------------------------------------------------------------------------
// 历史版本（触发器自动快照，每个单元只留最近 30 版）
// ---------------------------------------------------------------------------

export interface TranslationVersion {
  id: number;
  unit: string;
  title: string;
  summary: string;
  content: string;
  segments: TrSegment[] | null;
  status: TranslationStatus;
  sourceHash: string;
  savedAt: string;
}

/** unit：'article'（标题/摘要/非小说正文）或 'chapter:<章节id>' */
export async function listTranslationVersions(
  articleId: string,
  locale: Locale,
  unit: string,
): Promise<TranslationVersion[]> {
  const { data, error } = await supabase
    .from('article_translation_versions')
    .select('*')
    .eq('article_id', articleId)
    .eq('locale', locale)
    .eq('unit', unit)
    .order('saved_at', { ascending: false })
    .limit(30);
  if (error) {
    if (!isMissingTable(error)) console.warn('[i18n] 读取历史版本失败：', error.message);
    return [];
  }
  return (data || []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: Number(row.id ?? 0),
      unit: String(row.unit ?? ''),
      title: String(row.title ?? ''),
      summary: String(row.summary ?? ''),
      content: String(row.content ?? ''),
      segments: toTrSegments(row.segments),
      status: row.status === 'reviewed' ? 'reviewed' : 'draft',
      sourceHash: String(row.source_hash ?? ''),
      savedAt: String(row.saved_at ?? ''),
    };
  });
}

// ---------------------------------------------------------------------------
// 展示层：把译文套到中文原文上（缺什么回退什么）
// ---------------------------------------------------------------------------

export interface LocalizedArticle {
  article: Article;
  /** 是否拿到了这篇的译文（用于显示/隐藏「only available in Chinese」提示） */
  translated: boolean;
  /** 英文标题是否真的有了（列表卡片也用它判断要不要换标题） */
  hasTitle: boolean;
  /** 小说里逐章回退的情况：章节标题/正文有没有换成英文 */
  chapterFallback: boolean;
  /** 中文原稿在译文之后改过（只给工作台/总览提示，公开页不提示） */
  stale: boolean;
  /**
   * ★ 2026-09-22 给「字数」显示用：正文里**已译部分 / 中文回退部分**各自的量。
   *   null ＝ 这篇还没有任何译文（英文页据此显示中文字数：N characters，
   *   数字与中文站同一篇完全相同）。见 lib/wordCount.ts 的 formatCountLabel。
   *   小说另见每章的 `chapter.counts`。
   */
  counts: CountParts | null;
}

/**
 * 用译文覆盖中文原文，产出用于渲染的 Article。
 * 回退规则（逐字段独立判断，不搞「一处缺就整体回退」）：
 *   · 标题空 → 用中文标题；摘要空 → 用中文摘要；正文空 → 用中文正文。
 *   · **段落模式**（v2）：逐段回退——没译的那段显示中文原文，不加任何标记
 *     （Saber 2026-09-21 选的 A 口径：让英文页读起来不断裂、读者感知最小）。
 *   · **标签**（P5）：走全局词典（第三参数 tags），词典里没有的那个标签
 *     原样显示中文——同一条 A 口径，不加标记。
 *   · 小说：逐章按 id 对齐，某章完全没译文就用中文那一章。
 */
export function localizeArticle(
  article: Article,
  tr: ArticleTranslation | null | undefined,
  tags?: TagMap | null,
): LocalizedArticle {
  // 标签先换：**即使这篇还没有任何译文**，标签词典也照样生效
  // （标签是全站共用的，不该被「这篇没译」连累）
  const localizedTags =
    tags && article.tags?.length ? article.tags.map((t) => tags[t] || t) : article.tags;

  if (!tr) {
    return {
      article: localizedTags === article.tags ? article : { ...article, tags: localizedTags },
      translated: false,
      hasTitle: false,
      chapterFallback: false,
      stale: false,
      counts: null,
    };
  }
  const hasTitle = !!tr.title.trim();
  const hasContent = !!tr.content.trim() || !!tr.segments?.length;
  const translated = hasTitle || hasContent || !!tr.chapters?.length;
  const stale = !!tr.sourceHash && articleSourceHash(article) !== tr.sourceHash;

  // 非小说：段落模式优先
  let content = article.content;
  let counts: CountParts | null = null;
  if (tr.segments?.length) {
    const aligned = alignSegments(splitSegments(article.content), tr.segments);
    content = mergeContent(aligned);
    counts = partsOfAligned(aligned);
  } else if (hasContent) {
    content = tr.content;
    counts = { words: countWords(tr.content, 'en'), chars: 0 };
  }

  let novel = article.novel;
  let chapterFallback = false;
  if (article.novel?.chapters?.length) {
    const byId = new Map((tr.chapters || []).map((c) => [c.id, c]));
    const chapters: NovelChapter[] = article.novel.chapters.map((zh) => {
      const en = byId.get(zh.id);
      if (!en || (!en.content?.trim() && !en.title?.trim() && !en.segments?.length)) {
        if (en === undefined) chapterFallback = true;
        return zh; // 这一章整章没译 → 不带 counts，英文页按中文字数说
      }
      let body = zh.content;
      let chCounts: CountParts | null = null;
      if (en.segments?.length) {
        const aligned = alignSegments(splitSegments(zh.content), en.segments);
        body = mergeContent(aligned);
        chCounts = partsOfAligned(aligned);
      } else if (en.content.trim()) {
        body = en.content;
        chCounts = { words: countWords(en.content, 'en'), chars: 0 };
      }
      return {
        ...zh,
        title: en.title.trim() ? en.title : zh.title,
        content: body,
        counts: chCounts,
      };
    });
    novel = {
      ...article.novel,
      synopsis: tr.summary.trim() ? tr.summary : article.novel.synopsis,
      chapters,
    };
  }

  return {
    article: {
      ...article,
      tags: localizedTags,
      title: hasTitle ? tr.title : article.title,
      summary: tr.summary.trim() ? tr.summary : article.summary,
      content,
      novel,
    },
    translated,
    hasTitle,
    chapterFallback,
    stale,
    counts,
  };
}

/** 全文搜索用：把译文正文拼成可搜索文本 */
export function translationSearchText(tr: ArticleTranslation | undefined): string {
  if (!tr) return '';
  const parts = [tr.title, tr.summary, tr.content];
  for (const c of tr.chapters || []) parts.push(c.title || '', c.content || '');
  for (const s of tr.segments || []) parts.push(s.en || '');
  return parts.filter(Boolean).join('\n');
}

/** 工作台/总览用：把一段中文与已存译文对齐（段落级状态 + 进度） */
export function alignedFor(source: string, segments: TrSegment[] | null): AlignedSegment[] {
  return alignSegments(splitSegments(source), segments);
}
