import { useEffect } from 'react';
import { useT } from '../i18n';

// 动态设置浏览器标签页标题；不传参时恢复为站点名。
// ★ 英文版（2026-09-21）：站点名与分隔符都走字典——
//   中文 `{标题} - 呓语集`（与原来**完全一致**，一字未改），
//   英文 `{Title} · The Set of Murmurs`。
export function usePageTitle(title?: string) {
  const t = useT();
  useEffect(() => {
    const base = t('brand.full');
    document.title = title ? `${title}${t('brand.titleSep')}${base}` : base;
  }, [title, t]);
}
