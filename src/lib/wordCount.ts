// ============================================================================
// 字数 / 词数统计（2026-09-21 英文版 P2，对应词表决策 5「重新数词」）
// ----------------------------------------------------------------------------
// 背景：`novel.wordCount` / `chapter.wordCount` 是**写入时**算的
//   content.replace(/\s/g, '').length
// 对中文＝字数（没问题），对英文＝**字母数**（把它当 words 显示就是错的）。
//
// 口径（两条都要守住）：
//   · zh：**逐字沿用历史口径**——原样去空白数字符，连 Markdown 标记都算进去，
//         这样中文页上的每一个数字都与改动前**完全一致**（不许因为顺手清洗而变动）。
//   · en：先剥掉 Markdown 标记 / 代码块 / 公式，再按 [\p{L}\p{N}]+ 分词，得到真词数。
//
// 显示层按当前 locale 实时计算；`novel.wordCount` 降级为 fallback（内容缺失时用）。
// 影响面：首页书籍卡、/novels 书架、NovelCard、NovelReader（书头 / 目录 / 章节）。
// ============================================================================

import type { Locale } from '../i18n';

/** 剥掉不该计入词数的东西：围栏代码块、行内码、行间/行内公式、HTML 标签、链接语法 */
export function stripForWordCount(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')   // 围栏代码块
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ') // 行间公式
    .replace(/\$[^$\n]*\$/g, ' ')      // 行内公式
    .replace(/`[^`\n]*`/g, ' ')        // 行内码
    .replace(/<[^>]+>/g, ' ')          // HTML 标签
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接/图片 → 只留文字
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')       // 标题符
    .replace(/^\s{0,3}>\s?/gm, ' ')            // 引用符
    .replace(/^\s*[-*+]\s+/gm, ' ')            // 列表符
    .replace(/[*_~]{1,3}/g, ' ');              // 强调符
}

/** 按语言算「字数 / 词数」。内容为空时返回 0。 */
export function countWords(text: string | undefined | null, locale: Locale): number {
  if (!text) return 0;
  if (locale === 'en') {
    const words = stripForWordCount(text).match(/[\p{L}\p{N}]+/gu);
    return words ? words.length : 0;
  }
  // 中文口径：与历史实现逐字一致（不去 Markdown、不去标点）
  return text.replace(/\s/g, '').length;
}

/** 带千位分隔的数字（12,345），中英都用 */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

// ============================================================================
// ★ 2026-09-22 追加：英文站的「字数 / 词数」口径（用户原话
//   「英文站的中文文章能不能显示字数而不是词数，如果只翻译了部分段落就同时显示」）
// ----------------------------------------------------------------------------
// 规矩（英文页按**译文状态**说话，而不是按 locale 一刀切、也不靠猜正文语言）：
//   · 整篇没有译文（页面显示的就是中文原文） → `6,765 characters`
//     —— 数字 = 中文站同一篇的「字」数，**逐字相同**（同一个 countWords(text,'zh')）。
//   · 整篇译完了                            → `447 words`
//   · 只译了一部分段落（缺译段回退中文）      → `447 words · 6,765 characters`
//     两边的数字各自来自各自的文本：英文段只贡献词数、中文回退段只贡献字数。
//
// ★ 为什么按「译文状态」而不按「正文里有没有英文」猜（2026-09-22 踩过）：
//   中文数学文章里全是公式与字母、列表项又常常很短，用「这一段汉字少于 N 个就算英文段」
//   这种启发式，会把公式段算成 words、还会把没译文的文章误显示成中英混排
//   （实测：一篇 3,840 字的中文数学笔记在英文站被显示成「313 words · 278 characters」）。
//   所以切分只在**译文层**做：哪几段真的换了英文，由 alignSegments 说了算。
// ============================================================================

export interface CountParts {
  /** 已译部分（英文段）的词数 */
  words: number;
  /** 未译回退部分（中文段）的字数 */
  chars: number;
}

/**
 * 小说：把各章的切分加起来。
 * 没有 `counts` 的章＝那一章还没译文（渲染出来就是中文）→ 按中文字数算，
 * 于是整本没译的小说在英文站显示的就是中文站那个「字」数。
 */
export function sumChapterCounts(
  chapters: { content?: string; counts?: CountParts | null }[],
): CountParts {
  let words = 0;
  let chars = 0;
  for (const ch of chapters) {
    if (ch.counts) {
      words += ch.counts.words;
      chars += ch.counts.chars;
    } else {
      chars += countWords(ch.content, 'zh');
    }
  }
  return { words, chars };
}

type CountT = (key: 'count.words' | 'count.chars', params: { n: string }) => string;

/**
 * 公开页统一用的一句「字数」——中英两站、文章与小说都走它。
 *   parts：译文层算好的中英切分；**null ＝ 整篇没有译文**（英文页按字数说）。
 *   text ：渲染出来的正文（中文站与「没有切分信息时」的兜底都用它）。
 */
export function formatCountLabel(
  parts: CountParts | null | undefined,
  text: string | undefined | null,
  locale: Locale,
  t: CountT,
): string {
  // 中文站：一字不改（仍是「{n} 字」，口径与改动前逐字一致）
  if (locale !== 'en') {
    const n = countWords(text, 'zh');
    return n ? t('count.words', { n: formatCount(n) }) : '';
  }
  // 整篇没有译文 → 正文就是中文原文，按字数说，数字与中文站同一篇完全相同
  if (!parts) {
    const n = countWords(text, 'zh');
    return n ? t('count.chars', { n: formatCount(n) }) : '';
  }
  const { words, chars } = parts;
  if (words > 0 && chars > 0) {
    return `${t('count.words', { n: formatCount(words) })} · ${t('count.chars', { n: formatCount(chars) })}`;
  }
  if (words > 0) return t('count.words', { n: formatCount(words) });
  if (chars > 0) return t('count.chars', { n: formatCount(chars) });
  const n = countWords(text, 'zh');
  return n ? t('count.chars', { n: formatCount(n) }) : '';
}
