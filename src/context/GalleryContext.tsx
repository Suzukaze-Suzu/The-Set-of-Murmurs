import { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export interface GalleryImage {
  id: string;
  url: string;
  caption: string;
}

export const galleryStorageKey = 'yiyuji_gallery';

export function galleryUid() {
  return 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const sampleImages: GalleryImage[] = [
  {
    id: 'g0',
    url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
    caption: '山间晨雾',
  },
  {
    id: 'g1',
    url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80',
    caption: '湖边倒影',
  },
  {
    id: 'g2',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    caption: '天空的色彩',
  },
];

interface GalleryContextType {
  images: GalleryImage[];
  addImage: (url: string, caption?: string) => void;
  removeImage: (id: string) => void;
}

const GalleryContext = createContext<GalleryContextType | null>(null);

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useLocalStorage<GalleryImage[]>(galleryStorageKey, sampleImages);

  const addImage = (url: string, caption = '') => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setImages((prev) => [
      { id: galleryUid(), url: trimmed, caption: caption.trim() },
      ...prev,
    ]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <GalleryContext.Provider value={{ images, addImage, removeImage }}>
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error('useGallery must be used within GalleryProvider');
  return ctx;
}
