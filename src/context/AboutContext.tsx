import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { initialAbout, rememberAbout } from '../lib/siteCache';
import { useLocale } from '../i18n';

export interface AboutVersion {
  id: string;
  content: string;
  date: string;
  created_by?: string;
  /** 版本语言（2026-09-21 P3 新增列）：中文版＝zh，英文版＝en，各自独立版本史 */
  locale?: string;
}

export const aboutInitial = `## 关于「呓语集」

呓语集是一个用来记录 **动漫**、**随笔**、**读后感**、**数学笔记** 与 **学习分享** 的个人博客。

名字取自「呓语」，意喻着那些在心底呢喃、看似零碎却真实的想法。

本站支持 **Markdown** 与 **LaTeX** 数学公式写作。
`;

const AboutContext = createContext<{
  current: string;
  versions: AboutVersion[];
  loading: boolean;
  saving: boolean;
  /** 当前语言是否有自己的关于页正文（英文页没写过英文版时为 false → 页面显示中文原文＋提示） */
  hasOwnVersion: boolean;
  refresh: () => void;
  save: (content: string) => Promise<void>;
  loadVersion: (id: string) => void;
  rollback: (id: string) => Promise<void>;
  reset: () => void;
} | null>(null);

export function AboutProvider({ children }: { children: ReactNode }) {
  // 首屏直接用「本机缓存 > 构建时快照」里的线上正文（见 src/lib/siteCache.ts），
  // 不再先空着等请求，也不再用下面的 aboutInitial
  const [current, setCurrent] = useState<string>(() => initialAbout());
  const [versions, setVersions] = useState<AboutVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasOwnVersion, setHasOwnVersion] = useState(true);
  // 关于页正文分语言存版本（P3 起）：/about 读 zh 版本，/en/about 读 en 版本
  const { locale } = useLocale();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('about_versions')
        .select('*')
        .order('date', { ascending: false });
      if (error) {
        // 读失败：保留首屏已经填好的线上正文
        console.warn('[about] 关于页正文读取失败，沿用缓存/快照正文：', error.message);
        return;
      }
      const rows = (data || []).map((r) => ({
        id: r.id, content: r.content, date: r.date,
        created_by: r.created_by || undefined,
        locale: r.locale || 'zh',
      }));
      // 按当前语言挑：本语言有版本就用本语言，没有就回退中文原文（英文页会另加一行提示）
      const own = rows.filter((r) => r.locale === locale);
      if (own.length) {
        setVersions(own);
        setCurrent(own[0].content);
        if (locale === 'zh') rememberAbout(own[0].content); // 本机缓存只存中文正文（首屏用）
        setHasOwnVersion(true);
      } else {
        // 当前语言还没写过自己的版本：**正文**回退中文（英文页另给一行提示），
        // 但**版本史必须是空的**——2026-09-21 修：原先这里把中文版本列给英文页，
        // 「设为当前」一点就会把中文正文当成英文版写进 en 线（isolation 被破坏）。
        const zhRows = rows.filter((r) => r.locale === 'zh');
        setVersions([]);
        setCurrent(zhRows.length ? zhRows[0].content : aboutInitial);
        setHasOwnVersion(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [locale]);

  const save = async (content: string) => {
    setSaving(true);
    const row = {
      id: 'av_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      content: content,
      date: new Date().toISOString(),
      locale, // 保存到当前语言的那条线（/en/about 上写的进 en 版本史）
    };
    const { error } = await supabase.from('about_versions').insert(row);
    setSaving(false);
    if (!error) { await load(); }
    else throw new Error(error.message);
  };

  const loadVersion = (id: string) => {
    const v = versions.find((x) => x.id === id);
    if (v) setCurrent(v.content);
  };

  const rollback = async (id: string) => {
    const v = versions.find((x) => x.id === id);
    if (!v) return;
    await save(v.content);
  };

  const reset = () => {
    if (versions.length) setCurrent(versions[0].content);
    else setCurrent(aboutInitial);
  };

  return (
    <AboutContext.Provider value={{ current, versions, loading, saving, hasOwnVersion, refresh: load, save, loadVersion, rollback, reset }}>
      {children}
    </AboutContext.Provider>
  );
}

export function useAbout() {
  const ctx = useContext(AboutContext);
  if (!ctx) throw new Error('useAbout must be used within AboutProvider');
  return ctx;
}