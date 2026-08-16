import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { Comment } from '../types';
import { supabase } from '../lib/supabase';

function mkId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 一条新留言/评论的输入（name 一般由登录账号昵称自动带出）
export interface NewCommentInput {
  name: string;
  content: string;
  parentId?: string;
  parentName?: string;
  avatar?: string;
}

// 解析评论作者：已登录则按真实 userId 反查 profile 昵称/头像，
// 避免依赖前端异步加载的 myProfile（否则可能因时序/未设昵称而误存为匿名路人）。
async function resolveAuthor(input: NewCommentInput): Promise<{ name: string; avatar?: string; userId?: string }> {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const userId = data.user.id;
    const fallback = (data.user.email?.split('@')[0] || '').trim() || '匿名路人';
    const { data: p } = await supabase.from('profiles').select('nickname, avatar').eq('id', userId).maybeSingle();
    const nickname = (p?.nickname || '').trim() || fallback;
    return { userId, name: nickname, avatar: (p?.avatar || '') || undefined };
  }
  return { name: (input.name || '').trim() || '匿名路人' };
}

// 评论/留言被回复时，通知服务端发邮件给被回复者（失败不影响评论本身）
function notifyReply(input: NewCommentInput, replyName: string, targetType: 'comment' | 'guestbook') {
  if (!input.parentId || !replyName) return;
  fetch('/api/comment-notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentId: input.parentId,
      replyName,
      replyContent: input.content,
      targetType,
    }),
  }).catch(() => {});
}

interface Ctx {
  articleComments: Comment[];
  guestbook: Comment[];
  addArticleComment: (articleId: string, input: NewCommentInput) => void;
  addGuestbook: (input: NewCommentInput) => void;
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
          setGuestbook(data.map((r) => ({
            id: r.id, articleId: 'guestbook', name: r.name, content: r.content, date: r.date,
            userId: r.user_id || undefined, parentId: r.parent_id || undefined, parentName: r.parent_name || undefined,
            avatar: r.avatar || undefined,
          })));
        }
      });
    return () => { mounted = false; };
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
          setArticleComments(data.map((r) => ({
            id: r.id, articleId: r.article_id, name: r.name, content: r.content, date: r.date,
            userId: r.user_id || undefined, parentId: r.parent_id || undefined, parentName: r.parent_name || undefined,
            avatar: r.avatar || undefined,
          })));
        }
      });
    return () => { mounted = false; };
  }, []);

  const addArticleComment = (articleId: string, input: NewCommentInput) => {
    resolveAuthor(input).then((author) => {
      const newComment: Comment = {
        id: mkId(), articleId, name: author.name, content: input.content,
        date: new Date().toISOString(), parentId: input.parentId, parentName: input.parentName, avatar: author.avatar,
        userId: author.userId,
      };
      const row: Record<string, unknown> = { id: newComment.id, article_id: articleId, name: author.name, content: input.content };
      if (newComment.userId) row.user_id = newComment.userId;
      if (input.parentId) row.parent_id = input.parentId;
      if (input.parentName) row.parent_name = input.parentName;
      if (author.avatar) row.avatar = author.avatar;
      supabase
        .from('comments')
        .insert(row)
        .then(() => {
          setArticleComments((prev) => [newComment, ...prev]);
          notifyReply(input, author.name, 'comment');
        });
    });
  };

  const addGuestbook = (input: NewCommentInput) => {
    resolveAuthor(input).then((author) => {
      const newComment: Comment = {
        id: mkId(), articleId: 'guestbook', name: author.name, content: input.content,
        date: new Date().toISOString(), parentId: input.parentId, parentName: input.parentName, avatar: author.avatar,
        userId: author.userId,
      };
      const row: Record<string, unknown> = { id: newComment.id, name: author.name, content: input.content };
      if (newComment.userId) row.user_id = newComment.userId;
      if (input.parentId) row.parent_id = input.parentId;
      if (input.parentName) row.parent_name = input.parentName;
      if (author.avatar) row.avatar = author.avatar;
      supabase
        .from('guestbook')
        .insert(row)
        .then(() => {
          setGuestbook((prev) => [newComment, ...prev]);
          notifyReply(input, author.name, 'guestbook');
        });
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
