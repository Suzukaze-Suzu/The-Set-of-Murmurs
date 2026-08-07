import { useState, FormEvent } from 'react';
import { Comment } from '../types';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

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

const MAX_DEPTH = 2; // 留言最多展示 2 层（顶层 + 一层回复），更深折叠平铺

// 收集某节点的所有后代（任意深度），用于折叠后平铺展示
function collectDescendants(node: TreeNode): TreeNode[] {
  const arr: TreeNode[] = [];
  (function walk(n: TreeNode) {
    for (const ch of n.children) {
      arr.push(ch);
      walk(ch);
    }
  })(node);
  return arr;
}

// 超过最大层级的回复：折叠成「+N 条回复」，展开后平铺显示
function FoldedReplies({ root, currentUserId, isAdmin, onDelete, onStartReply, needLogin }: {
  root: TreeNode;
  currentUserId?: string;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
  onStartReply: (c: Comment) => void;
  needLogin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const items = collectDescendants(root);
  if (items.length === 0) return null;
  return (
    <div className="comment-fold">
      <button className="comment-fold-btn" onClick={() => setOpen((o) => !o)}>
        {open ? '收起折叠回复' : `+ ${items.length} 条回复`}
      </button>
      {open && (
        <div className="comment-fold-list">
          {items.map((n) => {
            const mine = !!onDelete && (isAdmin || (!!currentUserId && n.c.userId === currentUserId));
            return (
              <div className="comment-reply-row" key={n.c.id}>
                <div className="comment-head">
                  <Link to={n.c.userId ? '/profile?userId=' + n.c.userId : '/'} className="comment-avatar" title="查看个人主页">
                    {n.c.avatar ? <img src={n.c.avatar} alt="头像" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (n.c.name.trim().charAt(0) || '访')}
                  </Link>
                  <span className="comment-name-label">{n.c.parentName ? <em>{n.c.parentName}</em> : null} {n.c.name}</span>
                  <span className="comment-date">{new Date(n.c.date).toLocaleString()}</span>
                  {!needLogin && (
                    <button className="comment-reply" onClick={() => onStartReply({ ...n.c })}>回复</button>
                  )}
                  {mine && (
                    <button className="comment-delete" onClick={() => { if (window.confirm('确定删除这条留言吗？')) onDelete!(n.c.id); }}>
                      删除
                    </button>
                  )}
                </div>
                <p className="comment-body">{n.c.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommentRow({ node, depth, currentUserId, isAdmin, onDelete, onStartReply, needLogin }: {
  node: TreeNode;
  depth: number;
  currentUserId?: string;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
  onStartReply: (c: Comment) => void;
  needLogin: boolean;
}) {
  const { c, children } = node;
  const mine = !!onDelete && (isAdmin || (!!currentUserId && c.userId === currentUserId));
  const rowCls = depth === 0 ? 'comment-item' : 'comment-reply-row';
  return (
    <div className={rowCls}>
      <div className="comment-head">
        <Link to={c.userId ? '/profile?userId=' + c.userId : '/'} className="comment-avatar" title="查看个人主页">
          {c.avatar ? <img src={c.avatar} alt="头像" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (c.name.trim().charAt(0) || '访')}
        </Link>
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
        depth >= MAX_DEPTH - 1 ? (
          <FoldedReplies
            root={node}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onDelete={onDelete}
            onStartReply={onStartReply}
            needLogin={needLogin}
          />
        ) : (
          <div className="comment-children">
            {children.map((child) => (
              <CommentRow
                key={child.c.id}
                node={child}
                depth={depth + 1}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDelete={onDelete}
                onStartReply={onStartReply}
                needLogin={needLogin}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function CommentSection({ comments, onAdd, currentUserId, onDelete }: Props) {
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const { isAdmin } = useAuth();
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
            isAdmin={isAdmin}
            onDelete={onDelete}
            onStartReply={(c) => setReplyingTo(c)}
            needLogin={needLogin}
          />
        ))}
      </div>
    </div>
  );
}
