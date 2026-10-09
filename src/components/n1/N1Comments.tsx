import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Comment } from '../../types';
import { useProfile } from '../../context/ProfileContext';
import { useAuth } from '../../context/AuthContext';
import { useT, useLocale, formatDate } from '../../i18n';
import CommentMarkdown from '../CommentMarkdown';

interface Props {
  comments: Comment[];
  onAdd: (name: string, content: string, parentId?: string, parentName?: string, avatar?: string) => void;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

/* ══════════════════════════════════════════════════════════════════════════════
   N1Comments · 报纸语汇的评论区（2026-10-09，阅读页 / 小说本章）
   ──────────────────────────────────────────────────────────────────────────────
   用户裁决（2026-10-09）：阅读页上的评论区「**功能保留，但是风格修改**」——
   于是这里把**留言板那一套样张语汇**（`guestbook.html` 457-492 的
   `.gform`/`.grow`/`textarea`/`.gfoot`/`.gnote` ＋ `.msgs`/`.msg`/`.gface`/`.mtxt`/`.mhead`/`.mtagme`/`.mtime`）
   搬到文章评论上，**替掉旧组件 CommentSection 的外壳**，行为与文案一字未改：
     · 没登录＝`.gnote` 提示（`comment.signInTip`）
     · 表单：昵称格（登录昵称只读）＋ 正文 textarea ＋ `.gfoot`（回复中提示／已发表／Markdown 小注 ＋ 发表 ＋ 取消回复）
     · 列表：顶层评论 ＋ 它下面**一层**回复（`.msgs-sub`，见 `n1-app.css`；回复的回复落在同一层，
       靠「回 @谁」小签说明答的是谁——与留言板同口径）
     · 回复／删除按钮借 `.mhead` 里的小签位；删除仍走 `window.confirm(t('comment.deleteConfirm'))`
   `CommentSection.tsx` 原样留着：译文台等未迁移界面还在用它，也是本组件的回退对照。
   ══════════════════════════════════════════════════════════════════════════════ */

/* 昵称外圈那枚「字」＝ 昵称首字（与留言板同一写法）。
   没名字时用字典里的兜底字（中文「访」／英文 A）——原来写死「访」，英文页会露汉字。 */
const faceLetter = (name: string, fallback: string) => name.trim().charAt(0) || fallback;

type MsgNode = { c: Comment; replyTo?: string; replies: MsgNode[] };

/* 往上走到最外层那条评论（父链断掉或成环时就地当顶层） */
function topOf(node: MsgNode, byId: Map<string, MsgNode>): MsgNode {
  const seen = new Set([node.c.id]);
  let top = node;
  for (;;) {
    const parentId = top.c.parentId;
    if (!parentId) return top;
    const up = byId.get(parentId);
    if (!up || seen.has(up.c.id)) return top;
    seen.add(up.c.id);
    top = up;
  }
}

/* 平表 → 一层缩进：顶层按传入顺序（CommentContext 已排好），回复挂到最外层那条下面 */
function buildThreads(list: Comment[]): MsgNode[] {
  const byId = new Map<string, MsgNode>();
  list.forEach((c) => byId.set(c.id, { c, replies: [] }));
  const roots: MsgNode[] = [];
  list.forEach((c) => {
    const node = byId.get(c.id)!;
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    if (!parent) { roots.push(node); return; }
    node.replyTo = c.parentName || parent.c.name;
    const top = topOf(parent, byId);
    if (top === node) { roots.push(node); return; }
    top.replies.push(node);
  });
  return roots;
}

export default function N1Comments({ comments, onAdd, currentUserId, onDelete }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const { isAdmin, user } = useAuth();
  const { myProfile } = useProfile();

  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const needLogin = !currentUserId;
  const loginName = (myProfile?.nickname?.trim() || '');
  const loginAvatar = myProfile?.avatar || '';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(loginName || t('comment.anonymous'), content.trim(), replyingTo?.id, replyingTo?.name, loginAvatar);
    setContent('');
    setReplyingTo(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const canDelete = (c: Comment) => !!onDelete && !!user && (isAdmin || (!!c.userId && c.userId === user.id));

  /* 一行评论的三件：头像（有图用图、没图用昵称首字）／头行（名字＋回 @谁＋时间＋回复·删除）／正文。
     ★ 2026-10-09：头像恢复**可点**——用户报「按头像能到个人主页的功能也没有了」。
       迁移前 CommentSection 的口径是 `<Link to={'/profile?userId=' + c.userId}>`（title `comment.viewProfile`
       ＝「查看个人主页」），本组件重写时把它降级成了纯 img/span，这里照旧口径补回：
       有 userId 的注册用户 → 他的个人主页（`/profile?userId=`）；匿名留言没有 userId → 首页（同旧行为）。 */
  const face = (c: Comment) => (
    <Link
      className={`gface${c.avatar ? '' : ' letter'}`}
      to={c.userId ? '/profile?userId=' + c.userId : '/'}
      title={t('comment.viewProfile')}
      aria-label={t('comment.viewProfile')}
    >
      {c.avatar
        ? <img src={c.avatar} alt={c.name} loading="lazy" />
        : faceLetter(c.name, t('comment.avatarFallback'))}
    </Link>
  );

  const head = (c: Comment, replyTo?: string) => (
    <div className="mhead">
      <b>{c.name}</b>
      {replyTo && <span className="mtagme">{t('comment.replyToTag', { name: replyTo })}</span>}
      <span className="mtime">{formatDate(c.date, locale)}</span>
      {!needLogin && (
        <button type="button" className="btn ghost" onClick={() => setReplyingTo(c)}>
          {t('common.reply')}
        </button>
      )}
      {canDelete(c) && (
        <button
          type="button"
          className="btn ghost"
          onClick={() => { if (window.confirm(t('comment.deleteConfirm'))) onDelete!(c.id); }}
        >
          {t('common.delete')}
        </button>
      )}
    </div>
  );

  const threads = buildThreads(comments);

  return (
    <>
      {needLogin ? (
        <p className="gnote">{t('comment.signInTip')}</p>
      ) : (
        <form className="gform" onSubmit={handleSubmit}>
          <div className="grow">
            <input type="text" value={loginName} readOnly placeholder={t('comment.nickname')} />
          </div>
          <textarea
            placeholder={t('comment.saySomething')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="gfoot">
            <span className="gnote">
              {replyingTo
                ? t('comment.replyingTo', { name: replyingTo.name })
                : submitted
                  ? t('comment.posted')
                  : t('comment.markdownNote')}
            </span>
            <button type="submit" className="btn">{t('comment.post')}</button>
            {replyingTo && (
              <button type="button" className="btn ghost" onClick={() => setReplyingTo(null)}>
                {t('comment.cancelReply')}
              </button>
            )}
          </div>
        </form>
      )}

      <ul className="msgs">
        {threads.length === 0 && <li className="msg"><span className="gnote">{t('comment.empty')}</span></li>}
        {threads.map((node) => (
          <li className="msg" key={node.c.id}>
            {face(node.c)}
            <div className="mtxt">
              {head(node.c, node.replyTo)}
              {/* 留言正文走 Markdown（2026-10-09 用户「让留言支持markdown」）；
                  组件与正文那支分开，无反 HTML、无 KaTeX —— 见 CommentMarkdown.tsx 顶部说明 */}
              <CommentMarkdown content={node.c.content} />
              {node.replies.length > 0 && (
                <ul className="msgs-sub">
                  {node.replies.map((r) => (
                    <li className="msg" key={r.c.id}>
                      {face(r.c)}
                      <div className="mtxt">
                        {head(r.c, r.replyTo)}
                        <CommentMarkdown content={r.c.content} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
