import { useState, FormEvent } from 'react';
import { Comment } from '../types';

interface Props {
  comments: Comment[];
  onAdd: (name: string, content: string) => void;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

export default function CommentSection({ comments, onAdd, currentUserId, onDelete }: Props) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(name.trim() || '匿名路人', content.trim());
    setContent('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const needLogin = !currentUserId;

  return (
    <div className="comment-section">
      <h3 className="comment-title">留言（{comments.length}）</h3>

      {needLogin ? (
        <div className="comment-login-tip">登录后才能留言或评论哦～</div>
      ) : (
        <form className="comment-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="comment-name"
            placeholder="你的昵称（可留空）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
                <span className="comment-name-label">{c.name}</span>
                <span className="comment-date">{new Date(c.date).toLocaleString()}</span>
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
