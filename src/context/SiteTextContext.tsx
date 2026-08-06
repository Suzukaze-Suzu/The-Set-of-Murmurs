import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

const DEFAULTS: FooterText = {
  slogan: '呓语集 · 像凉风凉一样认真记录每个小瞬间',
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
  const [footer, setFooter] = useState<FooterText>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [histories, setHistories] = useState<Record<string, SiteTextVersion[]>>({});

  const load = async () => {
    const { data } = await supabase.from('site_texts').select('*');
    if (data && data.length) {
      const m: Record<string, string> = {};
      data.forEach((r) => { m[r.key] = r.content; });
      setFooter({
        slogan: m['footer_slogan'] ?? DEFAULTS.slogan,
        caption: m['footer_caption'] ?? '',
        copyright: m['footer_copyright'] ?? DEFAULTS.copyright,
      });
    } else {
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
