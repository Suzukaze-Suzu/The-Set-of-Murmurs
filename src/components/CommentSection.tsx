import { useState, FormEvent } from 'react';
import { Comment } from '../types';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useT, useLocale, formatDate } from '../i18n';

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

const MAX_DEPTH = 1; // 仅顶层留言展示为卡片，所有回复折叠平铺

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
  const t = useT();
  const { locale } = useLocale();
  const items = collectDescendants(root);
  if (items.length === 0) return null;
  return (
    <div className="comment-fold">
      <button className="comment-fold-btn" onClick={() => setOpen((o) => !o)}>
        {open ? t('comment.hideReplies') : t('comment.replies', { n: items.length })}
      </button>
      {open && (
        <div className="comment-fold-list">
          {items.map((n) => {
            const mine = !!onDelete && (isAdmin || (!!currentUserId && n.c.userId === currentUserId));
            return (
              <div className="comment-reply-row" key={n.c.id}>
                <div className="comment-head">
                  <Link to={n.c.userId ? '/profile?userId=' + n.c.userId : '/'} className="comment-avatar" title={t('comment.viewProfile')}>
                    {n.c.avatar ? <img src={n.c.avatar} alt={t('comment.avatar')} loading="lazy" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (n.c.name.trim().charAt(0) || t('comment.avatarFallback'))}
                  </Link>
                  <span className="comment-name-label">{n.c.parentName ? <em>{n.c.parentName}</em> : null} {n.c.name}</span>
                  <span className="comment-date">{formatDate(n.c.date, locale)}</span>
                  {!needLogin && (
                    <button className="comment-reply" onClick={() => onStartReply({ ...n.c })}>{t('common.reply')}</button>
                  )}
                  {mine && (
                    <button className="comment-delete" onClick={() => { if (window.confirm(t('comment.deleteConfirm'))) onDelete!(n.c.id); }}>
                      {t('common.delete')}
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
  const t = useT();
  const { locale } = useLocale();
  const mine = !!onDelete && (isAdmin || (!!currentUserId && c.userId === currentUserId));
  const rowCls = depth === 0 ? 'comment-item' : 'comment-reply-row';
  return (
    <div className={rowCls}>
      <div className="comment-head">
        <Link to={c.userId ? '/profile?userId=' + c.userId : '/'} className="comment-avatar" title={t('comment.viewProfile')}>
          {c.avatar ? <img src={c.avatar} alt={t('comment.avatar')} loading="lazy" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (c.name.trim().charAt(0) || t('comment.avatarFallback'))}
        </Link>
        <span className="comment-name-label">{c.parentName ? <em>{c.parentName}</em> : null} {c.name}</span>
        <span className="comment-date">{formatDate(c.date, locale)}</span>
        {!needLogin && (
          <button className="comment-reply" onClick={() => onStartReply({ ...c })}>{t('common.reply')}</button>
        )}
        {mine && (
          <button className="comment-delete" onClick={() => { if (window.confirm(t('comment.deleteConfirm'))) onDelete!(c.id); }}>
            {t('common.delete')}
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
  const t = useT();

  const { isAdmin } = useAuth();
  const { myProfile } = useProfile();
  const loginName = (myProfile?.nickname?.trim() || '');
  const loginAvatar = myProfile?.avatar || '';

  const needLogin = !currentUserId;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(loginName || t('comment.anonymous'), content.trim(), replyingTo?.id, replyingTo?.name, loginAvatar);
    setContent('');
    setReplyingTo(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const tree = buildTree(comments);

  return (
    <div className="comment-section">
      <h3 className="comment-title">{t('comment.title', { n: comments.length })}</h3>

      {needLogin ? (
        <div className="comment-login-tip">{t('comment.signInTip')}</div>
      ) : (
        <form className="comment-form" onSubmit={handleSubmit}>
          {replyingTo && (
            <div className="reply-target">
              {t('comment.replyingTo', { name: replyingTo.name })}<button type="button" className="reply-cancel" onClick={() => setReplyingTo(null)}>{t('comment.cancelReply')}</button>
            </div>
          )}
          <textarea
            className="comment-content"
            placeholder={t('comment.saySomething')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <button type="submit" className="btn btn-primary">{t('comment.post')}</button>
          {submitted && <span className="submit-ok">{t('comment.posted')}</span>}
        </form>
      )}

      <div className="comment-list">
        {tree.length === 0 && <p className="empty-tip">{t('comment.empty')}</p>}
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
