// ============================================================================
// 主导航的**唯一**路由表（2026-10-08 B2 报头：从 Navbar.tsx 搬到这里）
// ----------------------------------------------------------------------------
// 为什么搬：B2 报头要报「第 M 版」，口径是「当前页在导航里的序号」（计划书 §9 D1 已裁决），
// 而导航表原本只长在 Navbar.tsx 组件里。放在 lib 里，组件（渲染导航）与报头（算版次）
// 引同一份，不会各写一份漂移。
//
// active 判定统一成 startsWith：原来只有 pathname === path 才算激活，
// 所以停在 /article/xxx、/category/xxx 这类详情页时「文章」不会高亮。
// ★ 英文版（2026-09-21）：labelKey 是**字典键**，由 t() 按当前语言取词；
//    路由 to 仍是语言无关的（react-router 的 basename 会补上 /en 前缀）。
// ============================================================================

import type { DictKey } from '../i18n/dict';

export interface NavItem {
  to: string;
  labelKey: DictKey;
  match: (path: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', match: (p) => p === '/' },
  {
    to: '/articles',
    labelKey: 'nav.articles',
    match: (p) => p.startsWith('/articles') || p.startsWith('/article/') || p.startsWith('/category/'),
  },
  { to: '/novels', labelKey: 'nav.bookshelf', match: (p) => p.startsWith('/novels') },
  { to: '/gallery', labelKey: 'nav.gallery', match: (p) => p.startsWith('/gallery') },
  { to: '/guestbook', labelKey: 'nav.guestbook', match: (p) => p.startsWith('/guestbook') },
  { to: '/friends', labelKey: 'nav.friends', match: (p) => p.startsWith('/friends') },
  { to: '/about', labelKey: 'nav.about', match: (p) => p.startsWith('/about') },
];

/** 「写作」只在博主登录时进导航，所以它排在第 8 位（不是所有人的导航里都有） */
export const WRITE_ITEM: NavItem = {
  to: '/write',
  labelKey: 'nav.write',
  match: (p) => p.startsWith('/write'),
};

/**
 * 当前页在导航里的序号 ⇒ 报纸的「版次」（首页＝第 1 版，文章＝第 2 版…）。
 * 不在导航里的页（/login、/profile、404…）返回 0 ＝**不报版次**，而不是硬凑一个数。
 */
export function editionOf(pathname: string, isAdmin: boolean): number {
  const i = NAV_ITEMS.findIndex((it) => it.match(pathname));
  if (i >= 0) return i + 1;
  if (isAdmin && WRITE_ITEM.match(pathname)) return NAV_ITEMS.length + 1;
  return 0;
}
