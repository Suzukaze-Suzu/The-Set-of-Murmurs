import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface GalleryImage {
  id: string;
  url: string;
  caption: string;
}

export function galleryUid() {
  return 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface GalleryContextType {
  images: GalleryImage[];
  addImage: (url: string, caption?: string) => void;
  removeImage: (id: string) => void;
  loading: boolean;
}

const GalleryContext = createContext<GalleryContextType | null>(null);

export function GalleryProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) {
          setImages(data.map((row) => ({ id: row.id, url: row.url, caption: row.caption || '' })));
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const addImage = (url: string, caption = '') => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // 只有 admin 能添加图集；普通读者前端隐藏按钮，这里再兜底
    if (!isAdmin) return;
    const newImg: GalleryImage = { id: galleryUid(), url: trimmed, caption: caption.trim() };
    supabase
      .from('gallery')
      .insert({ id: newImg.id, url: newImg.url, caption: newImg.caption })
      .then(({ error }) => {
        if (!error) setImages((prev) => [newImg, ...prev]);
      });
  };

  const removeImage = (id: string) => {
    if (!isAdmin) return;
    supabase
      .from('gallery')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (!error) setImages((prev) => prev.filter((img) => img.id !== id));
      });
  };

  return (
    <GalleryContext.Provider value={{ images, addImage, removeImage, loading }}>
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error('useGallery must be used within GalleryProvider');
  return ctx;
}
