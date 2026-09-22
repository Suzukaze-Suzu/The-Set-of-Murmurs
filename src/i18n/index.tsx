// ============================================================================
// 呓语集 · i18n 运行时（不引第三方依赖，约 100 行）
// ----------------------------------------------------------------------------
// 路线 B：中文站原样留在 /，英文站在 /en/ 前缀下。
//
// 关键取舍（为把改动面压到最小）：
//   · 用 react-router 的 **basename** 来承载语言前缀，而不是在每个 <Link> 上手写前缀。
//     在 /en/articles 下 basename='/en'，于是现有代码里所有 <Link to="/articles">、
//     useNavigate('/write') 一律自动变成 /en/articles、/en/write——全站路由代码零改动。
//   · 语言**只由 URL 决定**（不存 localStorage、不看 navigator.language）：
//     一个 URL 必须永远对应一种语言，否则你分享出去的链接会因对方浏览器语言而变样，
//     SEO 的 hreflang 也会自相矛盾。想换语言就点顶栏那颗按钮换 URL。
//   · <html lang> 跟随 URL 同步，供浏览器选字形、断词、朗读与爬虫判语言。
// ============================================================================

import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { dict, DictKey } from './dict';

export type Locale = 'zh' | 'en';

export const LOCALES: Locale[] = ['zh', 'en'];

/** 语言前缀：中文在根，英文在 /en */
export const LOCALE_BASE: Record<Locale, string> = { zh: '', en: '/en' };

/** 从当前 pathname 判断语言（URL 是唯一依据） */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh';
}

/** react-router 的 basename：英文线要带上 /en */
export function basenameFor(locale: Locale): string {
  return LOCALE_BASE[locale] || '/';
}

/**
 * 把当前路径换到另一种语言。
 * 例：/en/articles?q=x  →  /articles?q=x
 *     /article/abc      →  /en/article/abc
 */
export function switchLocaleHref(pathname: string, search: string, hash: string, to: Locale): string {
  const from = localeFromPath(pathname);
  let rest = pathname;
  if (from === 'en') rest = pathname.slice('/en'.length) || '/';
  const prefix = LOCALE_BASE[to];
  return (prefix + rest || '/') + search + hash;
}

/** 取词：{n} 占位；英文复数形态按 n===1 自动选 one/other */
export function translate(
  locale: Locale,
  key: DictKey,
  params?: Record<string, string | number>,
): string {
  const entry = dict[key];
  if (!entry) return key; // 缺键就把键名露在界面上，P2 抓漏一眼可见
  const raw = entry[locale];
  let s: string;
  if (typeof raw === 'string') {
    s = raw;
  } else {
    s = Number(params?.n) === 1 ? raw.one : raw.other;
  }
  if (!params) return s;
  s = s.replace(/\{(\w+)\}/g, (m, k) =>
    params[k] === undefined ? m : String(params[k]),
  );
  /* 内联复数（2026-09-22 追加）：`{m:chapter|chapters}` —— 展开成「**数字 + 变形后的单位**」
     （`{m:chapter|chapters}` + m=2 → `2 chapters`）。上面的 {one,other} 只按 `n` 选形态，
     而「共 1 本 · 2 章」这种**一句话里两个数字**都要变形的（英文会出现 `1 books`），用它写。
     注意数字本身由这里带出来，模板里不要再写一个 `{m}`。参数没传时整段原样留着，便于抓漏。 */
  s = s.replace(/\{(\w+):([^{}]*)\|([^{}]*)\}/g, (m, k, one, other) =>
    params[k] === undefined ? m : `${params[k]} ${Number(params[k]) === 1 ? one : other}`,
  );
  return s;
}

type LocaleCtx = {
  locale: Locale;
  base: string;
  /** 日期/时间的本地化标识：英文页用 en-GB（与英式拼写的口径一致），中文页 zh-CN */
  dateLocale: string;
  t: (key: DictKey, params?: Record<string, string | number>) => string;
  /** 中 ↔ 英 切换用的目标地址（保留当前路径、查询与锚点） */
  altHref: (to?: Locale) => string;
};

/** 日期本地化标识（与英式拼写口径一致） */
export const DATE_LOCALE: Record<Locale, string> = { zh: 'zh-CN', en: 'en-GB' };

/** 英式月份缩写 —— 注意 September 在英国英语里是 **Sept**（四个字母），与美式的 Sep 不同 */
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/**
 * 日期显示（2026-09-22 用户指定）：
 *   · 英文页 → `6 Sept. 2026`（用户原话「英文页面的日期使用 6 Sept. 2026 类似形式」）
 *   · 中文页 → 行为一律不变：纯日期字符串（articles.date 就是这么存的）原样显示，
 *     其余（评论/历史那种时间戳）仍走 `toLocaleString('zh-CN')`，与改动前逐字一致。
 *
 * ★ 两类值必须分开走（2026-09-22 第二轮修正，用户「检查一下数字」查出）：
 *   ① **纯日期串**（`articles.date`，恰好 10 字符 `YYYY-MM-DD`）：走正则取年月日，
 *      不过 `new Date()` —— 否则时区会把日期挪掉一天。
 *   ② **时间戳**（评论/留言的 `date`，ISO 带时区，如 `2026-08-16T16:52:30Z`）：
 *      必须和中文页看的是**同一个瞬间**，所以同样走 `new Date(value)` 取**本地**年月日。
 *      上一版对 ② 也走了 ①，直接切 ISO 串的 UTC 日期 → 英文页比中文页**早一天**
 *      （实测：中文 `2026/8/17 00:52:30` ↔ 英文 `16 Aug. 2026`；`2026/8/10 02:14:49` ↔ `9 Aug. 2026`）。
 */
export function formatDate(value: string | number | Date, locale: Locale): string {
  const s = typeof value === 'string' ? value : '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  /* 只有「恰好 10 个字符」才算纯日期串：带 T/时间的都是时间戳，得走本地时区 */
  const plainDate = !!iso && s.length === 10;
  if (locale === 'en') {
    if (plainDate) return `${Number(iso![3])} ${EN_MONTHS[Number(iso![2]) - 1]}. ${iso![1]}`;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getDate()} ${EN_MONTHS[d.getMonth()]}. ${d.getFullYear()}`;
  }
  if (plainDate) return s; // 中文页：纯日期原样（改前就是这么显示的）
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('zh-CN');
}

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<LocaleCtx>(() => {
    const base = basenameFor(locale);
    return {
      locale,
      base,
      dateLocale: DATE_LOCALE[locale],
      t: (key, params) => translate(locale, key, params),
      altHref: (to) => {
        const target = to ?? (locale === 'en' ? 'zh' : 'en');
        if (typeof window === 'undefined') return LOCALE_BASE[target] || '/';
        return switchLocaleHref(
          window.location.pathname,
          window.location.search,
          window.location.hash,
          target,
        );
      },
    };
  }, [locale]);

  // <html lang> 跟随 URL——这是给浏览器选字形、给爬虫判语言的依据
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

/** 只想取 t 的便捷钩子 */
export function useT() {
  return useLocale().t;
}
