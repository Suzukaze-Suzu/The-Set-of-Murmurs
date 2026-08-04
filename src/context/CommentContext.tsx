import { createContext, useContext, ReactNode } from 'react';
import { Comment } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

const commentsKey = 'yiyuji_comments';
const guestbookKey = 'yiyuji_guestbook';

function mkId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 文章评论
function useCommentStore(key: string) {
  const [comments, setComments] = useLocalStorage<Comment[]>(key, []);
  const addComment = (articleId: string, name: string, content: string) =>
    setComments((prev) =>
      [{ id: mkId(), articleId, name, content, date: new Date().toISOString() }, ...prev]
    );
  return { comments, addComment };
}

interface Ctx {
  articleComments: Comment[];
  addArticleComment: (articleId: string, name: string, content: string) => void;
  guestbook: Comment[];
  addGuestbook: (name: string, content: string) => void;
}

const CommentContext = createContext<Ctx | null>(null);

export function CommentProvider({ children }: { children: ReactNode }) {
  const { comments: articleComments, addComment: addArticleComment } = useCommentStore(commentsKey);
  const { comments: guestbook, addComment: addGuestbookComment } = useCommentStore(guestbookKey);

  const addGuestbook = (name: string, content: string) => addGuestbookComment('guestbook', name, content);

  return (
    <CommentContext.Provider value={{ articleComments, addArticleComment, guestbook, addGuestbook }}>
      {children}
    </CommentContext.Provider>
  );
}

export function useComments() {
  const ctx = useContext(CommentContext);
  if (!ctx) throw new Error('useComments must be used within CommentProvider');
  return ctx;
}
