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
