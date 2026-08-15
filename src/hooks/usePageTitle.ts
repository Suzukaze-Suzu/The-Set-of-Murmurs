import { useEffect } from 'react';

const BASE_TITLE = '呓语集';

// 动态设置浏览器标签页标题；不传参时恢复为站点名
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} - ${BASE_TITLE}` : BASE_TITLE;
  }, [title]);
}
