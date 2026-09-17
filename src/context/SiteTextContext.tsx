import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { initialFooter, rememberFooter } from '../lib/siteCache';

export interface SiteTextVersion {
  id: string;
  key: string;
  content: string;
  date: string;
}

export interface FooterText {
  slogan: string;
  caption: string;
  copyright: string;
}

// 兜底页脚文字：只在「线上 site_texts 表确实没有数据」时才用（正常情况见 src/lib/siteCache.ts）。
// 值＝2026-09-17 线上实际在用的文案（以前这里留着更早的 slogan，慢网/请求失败时会先闪出来）。
const DEFAULTS: FooterText = {
  slogan: '呓语集',
  caption: '',
  copyright: 'Powered by React + Vite · {year}',
};

const FooterContext = createContext<{
  footer: FooterText;
  saving: boolean;
  saveFooter: (next: FooterText) => Promise<void>;
  histories: Record<string, SiteTextVersion[]>;
} | null>(null);

export function FooterProvider({ children }: { children: ReactNode }) {
  // 首屏直接用「本机缓存 > 构建时快照」里的线上页脚文字（见 siteCache.ts）
  const [footer, setFooter] = useState<FooterText>(() => initialFooter());
  const [saving, setSaving] = useState(false);
  const [histories, setHistories] = useState<Record<string, SiteTextVersion[]>>({});

  const load = async () => {
    const { data, error } = await supabase.from('site_texts').select('*');
    if (error) {
      // 读失败：保留首屏已经填好的线上文案，不退回本文件里的兜底值
      console.warn('[siteText] 页脚文字读取失败，沿用缓存/快照文案：', error.message);
    } else if (data && data.length) {
      const m: Record<string, string> = {};
      data.forEach((r) => { m[r.key] = r.content; });
      const next: FooterText = {
        slogan: m['footer_slogan'] ?? DEFAULTS.slogan,
        caption: m['footer_caption'] ?? '',
        copyright: m['footer_copyright'] ?? DEFAULTS.copyright,
      };
      setFooter(next);
      rememberFooter(next);   // 写回本机缓存，下次首屏直接用
    } else {
      // 线上确实没有这套文字，这才是「现在的状态」
      setFooter(DEFAULTS);
    }
    const { data: hd } = await supabase.from('site_text_versions').select('*').order('date', { ascending: false });
    if (hd) {
      const h: Record<string, SiteTextVersion[]> = {};
      hd.forEach((r) => {
        if (!h[r.key]) h[r.key] = [];
        h[r.key].push({ id: r.id, key: r.key, content: r.content, date: r.date });
      });
      setHistories(h);
    }
  };

  useEffect(() => { load(); }, []);

  const saveFooter = async (next: FooterText) => {
    setSaving(true);
    const items: { key: string; content: string }[] = [
      { key: 'footer_slogan', content: next.slogan },
      { key: 'footer_caption', content: next.caption },
      { key: 'footer_copyright', content: next.copyright },
    ];
    const { error } = await supabase.from('site_texts').upsert(items, { onConflict: 'key' });
    if (!error) {
      // 记录历史
      const now = new Date().toISOString();
      await Promise.all(items.map(async (it) => {
        await supabase.from('site_text_versions').insert({
          id: 'stv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '_' + it.key,
          key: it.key,
          content: it.content,
          date: now,
        });
      }));
      setFooter(next);
      rememberFooter(next);   // 站长自己改完页脚，本机首屏立刻就是新值
      await load();
    }
    setSaving(false);
    if (error) throw new Error(error.message);
  };

  return (
    <FooterContext.Provider value={{ footer, saving, saveFooter, histories }}>
      {children}
    </FooterContext.Provider>
  );
}

export function useFooter() {
  const ctx = useContext(FooterContext);
  if (!ctx) throw new Error('useFooter must be used within FooterProvider');
  return ctx;
}
