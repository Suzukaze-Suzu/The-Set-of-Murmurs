import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AboutVersion {
  id: string;
  content: string;      // 简介 Markdown 全文
  date: string;         // 修改时间
  created_by?: string;  // 修改人（博主 uuid）
}

// 关于页简介的初始内容（第一个版本）
export const aboutInitial = `## 关于「呓语集」

呓语集是一个用来记录 **动漫**、**随笔**、**读后感**、**数学笔记** 与 **学习分享** 的个人博客。

名字取自「呓语」，意喻着那些在心底呢喃、看似零碎却真实的想法。
正如凉风凉那样——外冷内热，嘴上敷衍，心里却格外珍视每一个认真生活的小瞬间。

本站支持 **Markdown** 与 **LaTeX** 数学公式写作，
可以在写作页直接编写，也可以导入 \`.md\` / \`.tex\` 文件。

## 主题灵感

网站配色灵感来自凉风凉：天空蓝的开衫、蜜金渐变珊瑚粉的长发、
清透青蓝的眼睛，以及清新而温暖的校园风。
`;

const AboutContext = createContext<{
  current: string;                 // 当前展示的简介 Markdown
  versions: AboutVersion[];        // 全部历史版本
  saving: boolean;
  refresh: () => void;
  save: (content: string) => Promise<void>;
  loadVersion: (id: string) => void;   // 预览某个历史版本（只改 current，不落库）
  rollback: (id: string) => Promise<void>;  // 把某个历史版本设为当前（生成新版本）
  reset: () => void;               // 取消预览，回到最新版本
} | null>(null);

export function AboutProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<string>(aboutInitial);
  const [versions, setVersions] = useState<AboutVersion[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
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
      // 没有数据时用初始内容展示（但不落库）
      setCurrent(aboutInitial);
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
    await save(v.content); // 生成一条新版本（内容等于该历史版本）
  };

  const reset = () => {
    if (versions.length) setCurrent(versions[0].content);
    else setCurrent(aboutInitial);
  };

  return (
    <AboutContext.Provider value={{ current, versions, saving, refresh: load, save, loadVersion, rollback, reset }}>
      {children}
    </AboutContext.Provider>
  );
}

export function useAbout() {
  const ctx = useContext(AboutContext);
  if (!ctx) throw new Error('useAbout must be used within AboutProvider');
  return ctx;
}
