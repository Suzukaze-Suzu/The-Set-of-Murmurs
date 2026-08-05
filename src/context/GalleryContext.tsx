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
  addImage: (file: File, caption?: string) => Promise<string | null>;
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

  const addImage = async (file: File, caption = '') => {
    // 只有 admin 能添加图集；普通读者前端隐藏按钮，这里再兜底
    if (!isAdmin) return '无权限';
    if (!file) return '请选择图片文件';
    const id = galleryUid();
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = id + '-' + safeName;
    const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) return '上传失败：' + upErr.message;
    const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path);
    const url = pub.publicUrl;
    const cap = caption.trim();
    const newImg: GalleryImage = { id, url, caption: cap };
    const { error } = await supabase.from('gallery').insert({ id, url, caption: cap });
    if (error) return '保存失败：' + error.message;
    setImages((prev) => [newImg, ...prev]);
    return null;
  };

  const removeImage = (id: string) => {
    if (!isAdmin) return;
    const target = images.find((img) => img.id === id);
    supabase
      .from('gallery')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (!error) {
          if (target && target.url.includes('/storage/v1/object/public/gallery/')) {
            const path = decodeURIComponent(target.url.split('/gallery/')[1] || '');
            if (path) supabase.storage.from('gallery').remove([path]);
          }
          setImages((prev) => prev.filter((img) => img.id !== id));
        }
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
