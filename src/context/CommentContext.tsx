import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { Comment } from '../types';
import { supabase } from '../lib/supabase';

function mkId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface Ctx {
  articleComments: Comment[];
  guestbook: Comment[];
  addArticleComment: (articleId: string, name: string, content: string) => void;
  addGuestbook: (name: string, content: string) => void;
  deleteComment: (id: string, type: 'comment' | 'guestbook') => void;
}

const CommentContext = createContext<Ctx | null>(null);

export function CommentProvider({ children }: { children: ReactNode }) {
  const [articleComments, setArticleComments] = useState<Comment[]>([]);
  const [guestbook, setGuestbook] = useState<Comment[]>([]);

  // 加载留言板
  useEffect(() => {
    let mounted = true;
    supabase
      .from('guestbook')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) {
          setGuestbook(data.map((r) => ({ id: r.id, articleId: 'guestbook', name: r.name, content: r.content, date: r.date, userId: r.user_id || undefined })));
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 加载所有文章评论
  useEffect(() => {
    let mounted = true;
    supabase
      .from('comments')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) {
          setArticleComments(data.map((r) => ({ id: r.id, articleId: r.article_id, name: r.name, content: r.content, date: r.date, userId: r.user_id || undefined })));
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const addArticleComment = (articleId: string, name: string, content: string) => {
    const newComment: Comment = { id: mkId(), articleId, name, content, date: new Date().toISOString() };
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) newComment.userId = data.user.id;
      const row: Record<string, unknown> = { id: newComment.id, article_id: articleId, name, content };
      if (newComment.userId) row.user_id = newComment.userId;
      supabase
        .from('comments')
        .insert(row)
        .then(() => setArticleComments((prev) => [newComment, ...prev]));
    });
  };

  const addGuestbook = (name: string, content: string) => {
    const newComment: Comment = { id: mkId(), articleId: 'guestbook', name, content, date: new Date().toISOString() };
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) newComment.userId = data.user.id;
      const row: Record<string, unknown> = { id: newComment.id, name, content };
      if (newComment.userId) row.user_id = newComment.userId;
      supabase
        .from('guestbook')
        .insert(row)
        .then(() => setGuestbook((prev) => [newComment, ...prev]));
    });
  };


  const deleteComment = (id: string, type: 'comment' | 'guestbook') => {
    const table = type === 'guestbook' ? 'guestbook' : 'comments';
    supabase.from(table).delete().eq('id', id).then(() => {
      if (type === 'guestbook') setGuestbook((prev) => prev.filter((c) => c.id !== id));
      else setArticleComments((prev) => prev.filter((c) => c.id !== id));
    });
  };

  return (
    <CommentContext.Provider value={{ articleComments, addArticleComment, guestbook, addGuestbook, deleteComment }}>
      {children}
    </CommentContext.Provider>
  );
}

export function useComments() {
  const ctx = useContext(CommentContext);
  if (!ctx) throw new Error('useComments must be used within CommentProvider');
  return ctx;
}
