import { useCallback, useEffect, useRef, useState } from 'react';

/* ══════════════════════════════════════════════════════════════════════════════
   localStorage 状态（2026-11-10 修「小说字号调节无作用」）
   ──────────────────────────────────────────────────────────────────────────────
   故障：阅读页正文的字号/行距由 `NovelReader` 的 `useLocalStorage('novel-font')` 读一次、
   写在 `.prose-read` 的内联样式上；下方设置栏 `ReaderSettings` 另开了一个同名 key 的实例。
   旧实现里两个实例各持一份 state、只往 localStorage 写，**同文档内互不通知** ⇒
   点「L」只有按钮高亮跟着走，正文不动；刷新一次才吃新值（用户看到的就是「字号调节无作用」）。

   现在：同 key 的实例共用一个模块级订阅表，写入时广播；另挂 `storage` 事件支持跨标签页。
   API 形状不变 —— `[value, setValue]`，`setValue` 仍接受值或 `(prev) => next`。
   只在 setter 里落盘（不再用 effect 回写），首次挂载不会平白覆盖 localStorage。
   ══════════════════════════════════════════════════════════════════════════════ */

type Listener = (value: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

function broadcast(key: string, value: unknown) {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) fn(value);
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setState] = useState<T>(() => readStorage(key, initialValue));
  const latest = useRef<T>(value);
  const initial = useRef(initialValue);

  // 本实例当前值（函数式更新时当 prev 用，不依赖 React 的异步渲染时序）
  latest.current = value;

  // ① 同文档：订阅同 key 的其它实例 ② 跨标签页：storage 事件
  useEffect(() => {
    const apply = (next: T) => {
      latest.current = next;
      setState(next);
    };
    const listener: Listener = (v) => apply(v as T);
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(listener);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      apply(readStorage<T>(key, initial.current));
    };
    window.addEventListener('storage', onStorage);

    return () => {
      set?.delete(listener);
      if (set && set.size === 0) listeners.delete(key);
      window.removeEventListener('storage', onStorage);
    };
  }, [key]);

  // key 换了（如 `novel-progress-<书id>` 在数据到达后才定）→ 重新读
  useEffect(() => {
    const next = readStorage<T>(key, initial.current);
    latest.current = next;
    setState(next);
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = latest.current;
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      latest.current = v;
      writeStorage(key, v);
      setState(v);
      broadcast(key, v);
    },
    [key],
  );

  return [value, setValue] as const;
}
