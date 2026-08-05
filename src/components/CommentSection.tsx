import { useState, FormEvent } from 'react';
import { Comment } from '../types';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';

interface Props {
  comments: Comment[];
  onAdd: (name: string, content: string, parentId?: string, parentName?: string, avatar?: string) => void;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

// 把扁平评论构造成带 children 的树（用于将回复嵌套在原评论下方）
interface TreeNode {
  c: Comment;
  children: TreeNode[];
}

function buildTree(comments: Comment[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  comments.forEach((c) => map.set(c.id, { c, children: [] }));
  const roots: TreeNode[] = [];
  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CommentRow({ node, depth, currentUserId, onDelete, onStartReply, needLogin }: {
  node: TreeNode;
  depth: number;
  currentUserId?: string;
  onDelete?: (id: string) => void;
  onStartReply: (c: Comment) => void;
  needLogin: boolean;
}) {
  const { c, children } = node;
  const mine = !!currentUserId && !!onDelete && c.userId === currentUserId;
  return (
    <div className="comment-item" style={depth > 0 ? { marginLeft: depth * 18, borderLeft: '3px solid color-mix(in srgb,var(--sky-blue) 30%,transparent)', borderTopLeftRadius: 4 } : undefined}>
      <div className="comment-head">
        <span className="comment-avatar">
          {c.avatar ? <img src={c.avatar} alt="头像" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (c.name.trim().charAt(0) || '访')}
        </span>
        <span className="comment-name-label">{c.parentName ? <em>{c.parentName}</em> : null} {c.name}</span>
        <span className="comment-date">{new Date(c.date).toLocaleString()}</span>
        {!needLogin && (
          <button className="comment-reply" onClick={() => onStartReply({ ...c })}>回复</button>
        )}
        {mine && (
          <button className="comment-delete" onClick={() => { if (window.confirm('确定删除这条留言吗？')) onDelete!(c.id); }}>
            删除
          </button>
        )}
      </div>
      <p className="comment-body">{c.content}</p>
      {children.length > 0 && (
        <div className="comment-children">
          {children.map((child) => (
            <CommentRow
              key={child.c.id}
              node={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onStartReply={onStartReply}
              needLogin={needLogin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentSection({ comments, onAdd, currentUserId, onDelete }: Props) {
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const { myProfile } = useProfile();
  const loginName = (myProfile?.nickname?.trim() || '');
  const loginAvatar = myProfile?.avatar || '';

  const needLogin = !currentUserId;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(loginName || '匿名路人', content.trim(), replyingTo?.id, replyingTo?.name, loginAvatar);
    setContent('');
    setReplyingTo(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const tree = buildTree(comments);

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
        {tree.length === 0 && <p className="empty-tip">还没有留言，来抢沙发吧～</p>}
        {tree.map((node) => (
          <CommentRow
            key={node.c.id}
            node={node}
            depth={0}
            currentUserId={currentUserId}
            onDelete={onDelete}
            onStartReply={(c) => setReplyingTo(c)}
            needLogin={needLogin}
          />
        ))}
      </div>
    </div>
  );
}
