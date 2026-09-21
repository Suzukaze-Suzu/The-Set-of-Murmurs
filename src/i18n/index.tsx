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
  return s.replace(/\{(\w+)\}/g, (m, k) =>
    params[k] === undefined ? m : String(params[k]),
  );
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
