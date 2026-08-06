import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AboutVersion {
  id: string;
  content: string;
  date: string;
  created_by?: string;
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
  refresh: () => void;
  save: (content: string) => Promise<void>;
  loadVersion: (id: string) => void;
  rollback: (id: string) => Promise<void>;
  reset: () => void;
} | null>(null);

export function AboutProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<string>('');
  const [versions, setVersions] = useState<AboutVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('about_versions')
        .select('*')
        .order('date', { ascending: false });
      if (data && data.length) {
        const mapped = data.map((r) => ({
          id: r.id, content: r.content, date: r.date,
          created_by: r.created_by || undefined,
        }));
        setVersions(mapped);
        setCurrent(mapped[0].content);
      } else {
        setVersions([]);
        setCurrent(aboutInitial);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (content: string) => {
    setSaving(true);
    const row = {
      id: 'av_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      content: content,
      date: new Date().toISOString(),
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
    <AboutContext.Provider value={{ current, versions, loading, saving, refresh: load, save, loadVersion, rollback, reset }}>
      {children}
    </AboutContext.Provider>
  );
}

export function useAbout() {
  const ctx = useContext(AboutContext);
  if (!ctx) throw new Error('useAbout must be used within AboutProvider');
  return ctx;
}