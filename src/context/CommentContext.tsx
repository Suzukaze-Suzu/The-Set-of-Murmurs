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

/** 发表结果：页面靠它决定「清空并提示已发表」还是「保留正文并报错」。 */
export interface PostResult {
  ok: boolean;
  error?: string;
}

/**
 * 把数据库/网络的报错分成三类，好让人话能对得上（页面用 `comment.postFail*` 三档文案）。
 * 原文（英文的 PostgREST message）仍然一并显示在「技术原因：…」里，方便排查。
 */
export type PostFailKind = 'net' | 'denied' | 'other';
export function classifyPostError(raw: string): PostFailKind {
  const m = (raw || '').toLowerCase();
  if (!m || /fetch|network|timeout|abort|load failed|connection|reset|offline/.test(m)) return 'net';
  if (/row-level security|42501|permission|not authorized|forbidden|jwt|invalid claim|401|403/.test(m)) return 'denied';
  return 'other';
}

/**
 * 解析评论作者：**不再联网问服务端「我是谁」**（2026-10-09「留言板发表不了了」那一轮的 S1）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 老口径是 `await supabase.auth.getUser()` —— 那是一次**真网络往返**（GET /auth/v1/user）。
 * 发表一条留言本来只要一次 insert，却要在前面串上这次往返；国内直连 supabase 时
 * 它一旦被掐住，`resolveAuthor` 的 promise 永不落地，点击「发表」就**永远没反应**
 * （探针 probe-guestbook-real.mjs 的实测：点完之后只发出这一条请求，然后什么都没有）。
 *
 * 现在：session 本来就在本地（`getSession()` 只读 localStorage，不发请求），
 * userId 从它拿；昵称/头像优先用页面已经加载好的 myProfile（由调用方通过 input 传进来），
 * 只有它为空时才去查一次 profiles，而且**3 秒封顶**——超时就先用页面上的昵称顶上，
 * 绝不因为一个「锦上添花」的昵称把发表卡死。
 */
async function resolveAuthor(input: NewCommentInput): Promise<{ name: string; avatar?: string; userId?: string }> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return { name: (input.name || '').trim() || '匿名路人' };

  /* 页面传过来的昵称：**「匿名路人／Anonymous」是兜底文案、不算真昵称**——
     两处调用方都写着 `loginName || t('comment.anonymous')`，myProfile 还没加载出来时
     传进来的就是这个占位词。老口径一律回库查昵称（所以不会存成匿名），
     这里保留那条保证：占位词或没头像时，才去查一次 profiles。 */
  const fromPage = (input.name || '').trim();
  const isPlaceholder = !fromPage || fromPage === '匿名路人' || fromPage === 'Anonymous';
  let nickname = isPlaceholder ? '' : fromPage;
  let avatar: string | undefined = input.avatar || undefined;

  if (isPlaceholder || !avatar) {
    try {
      const res = await Promise.race([
        supabase.from('profiles').select('nickname,avatar').eq('id', u.id).maybeSingle(),
        new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
      ]);
      const p = (res as { data: { nickname?: string; avatar?: string } | null }).data;
      if (p?.nickname && p.nickname.trim()) nickname = p.nickname.trim();
      if (p?.avatar && !avatar) avatar = p.avatar;
    } catch { /* 查不到就用页面上的 */ }
  }

  // 最后兜底：账号邮箱前缀（与旧口径一致）；再没有就还回占位词
  if (!nickname) nickname = (u.email?.split('@')[0] || '').trim() || fromPage || '匿名路人';
  return { userId: u.id, name: nickname, avatar };
}

/**
 * 写库并**如实回报成功与否**（S2/S4）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 老口径是 `insert(row).then(() => setXxx([新条目, ...prev]))` —— **根本不看返回的 error**。
 * supabase-js 在 403/网络被掐时也是「正常 resolve，error 放在结果里」，
 * 于是写库失败了，页面上照样把这条留言显示出来（探针 probe-post-failure.mjs 实测：
 * 403 与网络掐断两种失败下都是 `typedInList: true`、页面上一个字报错都没有）。
 * 用户视角＝看着发表成功了，刷新／别人那边却没有 —— 这就是「发表不了了」。
 *
 * 现在：成功才返回 ok；失败先按**客户端生成的 id** 核对一次「是不是其实已经写进去了」
 * （防止响应丢包导致重复），确认没写进去、且错误属于**网络类**（没有 PostgREST code，
 * 或 message 里是 fetch/timeout/abort）时才重试一次。权限/约束类错误不重试。
 */
async function insertRow(table: 'guestbook' | 'comments', row: Record<string, unknown>): Promise<PostResult> {
  const id = String(row.id);
  const exists = async () => {
    try {
      const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
      return !!data;
    } catch { return false; }
  };

  const first = await supabase.from(table).insert(row);
  if (!first.error) return { ok: true };
  if (await exists()) return { ok: true };   // 写进去了、只是响应没回来

  const msg = first.error.message || '';
  const isNetwork = !first.error.code || /fetch|network|timeout|abort|load failed/i.test(msg);
  if (!isNetwork) return { ok: false, error: msg };

  const second = await supabase.from(table).insert(row);
  if (!second.error) return { ok: true };
  if (await exists()) return { ok: true };
  return { ok: false, error: (second.error.message || msg) };
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
  addArticleComment: (articleId: string, input: NewCommentInput) => Promise<PostResult>;
  addGuestbook: (input: NewCommentInput) => Promise<PostResult>;
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

  const addArticleComment = async (articleId: string, input: NewCommentInput): Promise<PostResult> => {
    const author = await resolveAuthor(input);
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

    const res = await insertRow('comments', row);
    if (!res.ok) return res;                     // 失败就不入列，交给页面报错
    setArticleComments((prev) => [newComment, ...prev]);
    notifyReply(input, author.name, 'comment');
    return res;
  };

  const addGuestbook = async (input: NewCommentInput): Promise<PostResult> => {
    const author = await resolveAuthor(input);
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

    const res = await insertRow('guestbook', row);
    if (!res.ok) return res;                     // 失败就不入列，交给页面报错
    setGuestbook((prev) => [newComment, ...prev]);
    notifyReply(input, author.name, 'guestbook');
    return res;
  };

  const deleteComment = (id: string, type: 'comment' | 'guestbook') => {
    const table = type === 'guestbook' ? 'guestbook' : 'comments';
    supabase.from(table).delete().eq('id', id).then(({ error }) => {
      // 2026-10-09：删除也看回执了 —— 删不掉就别在界面上装作删掉了（同一族的老毛病）
      if (error) { console.warn('[comment] 删除失败：', error.message); return; }
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
