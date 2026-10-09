// ============================================================================
// B2 报头 · 日期 / 期号 / 版次的取值口径（2026-10-08）
// ----------------------------------------------------------------------------
// 计划书 §9 D1 的裁决（用户原话「同意修改版号，文章总数是多少期」）：
//   · **期** ＝ 数据库里**公开文章总数**（发一篇自动涨一期，不写死）
//   · **版** ＝ 当前页在导航里的序号（首页第 1 版、文章第 2 版 …），见 lib/navItems.ts
//   · **日期** ＝ 当天，随语言换格式（中文「2026 年 10 月 8 日 星期四」，
//     英文按站点的英式口径走 en-GB「Thursday, 8 October 2026」）
//
// 期号走**运行时**读 ArticleProvider 里的 articles.length（同一张 articles 表，
// 构建期读值能做到的事它都能做到，而且发新文章不必等重新构建）。
// 首屏 / 断网 / 预渲染时用 ISSUE_FALLBACK（＝2026-10-02 实测的公开文章数 12 篇）。
// ============================================================================

import type { Locale } from '../i18n';

/** 兜底期号：数据库还没回、或断网时显示它（不是写死的期号，是「上次已知的真值」） */
export const ISSUE_FALLBACK = 12;

/** 版眉 / 报头信息条上的站点域名（与 B1 右刊眉同一处文案） */
export const SITE_DOMAIN = 'the-set-of-murmurs.me';

/** 拉丁刊名：中英两站都这一行（它就是站点的英文名） */
export const LATIN_NAME = 'THE SET OF MURMURS';

const ZH_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 报头日期。
 * 中文刻意手工拼（`2026 年 10 月 8 日 星期四`）而不是让 toLocaleString 输出
 * `2026年10月8日星期四` —— N1 样张上就是带空格的写法，页面上的空隙感来自这几个空格。
 */
export function mastheadDate(locale: Locale, now: Date = new Date()): string {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(now);
  }
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 ${ZH_WEEKDAYS[now.getDay()]}`;
}
