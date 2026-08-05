import { useState, FormEvent } from 'react';
import { Comment } from '../types';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';

interface Props {
  comments: Comment[];
  onAdd: (name: string, content: string, parentId?: string, parentName?: string) => void;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

export default function CommentSection({ comments, onAdd, currentUserId, onDelete }: Props) {
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const { myProfile } = useProfile();

  // 默认用登录账号昵称；未登录时为空（由外层决定是否放行）
  const loginName = (myProfile?.nickname?.trim() || '');

  const needLogin = !currentUserId;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const name = replyingTo ? replyingTo.parentName || loginName : loginName;
    onAdd(loginName || '匿名路人', content.trim(), replyingTo?.id, replyingTo?.name);
    setContent('');
    setReplyingTo(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <div className="comment-section">
      <h3 className="comment-title">留言（{comments.length}）</h3>

      {needLogin ? (
        <div className="comment-login-tip">登录后才能留言或评论哦～</div>
      ) : (
        <form className="comment-form" onSubmit={handleSubmit}>
          {replyingTo && (
            <div className="reply-target">
              回复 @{replyingTo.name} · <button type="button" className="reply-cancel" onClick={() => setReplyingTo(null)}>取消回复</button>
            </div>
          )}
          <textarea
            className="comment-content"
            placeholder="说说你的想法吧…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <button type="submit" className="btn btn-primary">发表</button>
          {submitted && <span className="submit-ok">已发表</span>}
        </form>
      )}

      <div className="comment-list">
        {comments.length === 0 && <p className="empty-tip">还没有留言，来抢沙发吧～</p>}
        {comments.map((c) => {
          const mine = !!currentUserId && !!onDelete && c.userId === currentUserId;
          return (
            <div key={c.id} className="comment-item">
              <div className="comment-head">
                <span className="comment-avatar">{c.name.trim().charAt(0) || '访'}</span>
                <span className="comment-name-label">{c.parentName ? <>@<em>{c.parentName}</em></> : null} {c.name}</span>
                <span className="comment-date">{new Date(c.date).toLocaleString()}</span>
                {!needLogin && (
                  <button className="comment-reply" onClick={() => setReplyingTo({ ...c })}>回复</button>
                )}
                {mine && (
                  <button className="comment-delete" onClick={() => { if (window.confirm('确定删除这条留言吗？')) onDelete!(c.id); }}>
                    删除
                  </button>
                )}
              </div>
              <p className="comment-body">{c.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
