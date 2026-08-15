import { useEffect, useRef, useState } from 'react';

/**
 * 无限滚动列表：传入完整列表，返回可见子集 + 加载更多控制。
 * 传入的 items 应为稳定引用（如 useMemo 结果），列表内容变化时自动回到第一页。
 */
export function useInfiniteList<T>(items: T[], pageSize = 12) {
  const [count, setCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  // 列表内容变化时重置分页
  useEffect(() => {
    setCount(pageSize);
  }, [items, pageSize]);

  // 哨兵元素进入视口附近时加载更多
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => c + pageSizeRef.current);
        }
      },
      { rootMargin: '240px 0px' }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const visible = items.slice(0, count);
  const hasMore = count < items.length;

  return {
    visible,
    hasMore,
    total: items.length,
    sentinelRef,
    loadMore: () => setCount((c) => c + pageSizeRef.current),
  };
}
