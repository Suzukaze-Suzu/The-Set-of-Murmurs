import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useComments } from '../context/CommentContext';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale, formatDate } from '../i18n';
import { Comment, BugReport, BUG_CATEGORIES } from '../types';
import CommentMarkdown from '../components/CommentMarkdown';
import { supabase } from '../lib/supabase';

/* ══════════════════════════════════════════════════════════════════════════════
   留言页（2026-10-08「样张直接做前端」）
   ──────────────────────────────────────────────────────────────────────────────
   主体逐块照 `design-mockups\g\n1-broadsheet\guestbook.html`：
     · `.pagehead`＋`.pagehead-txt`(.kicker/.h1/.lede)                ← 样张 449-456
     · `.sec` ①：`.gform`（`.grow` 一格 input ＋ textarea ＋ `.gfoot`
       （`.gnote` ＋ `.btn`））                                        ← 样张 457-463
     · `.sec` ②：`.sec-head`（h2 ＋ small）＋ `.msgs`/`.msg`
       （`.gface`/`.gface.letter`/`.mtxt`/`.mhead`/`.mtagme`/`.mtime`）← 样张 464-492
   外壳（报头／报尾）由 N1Shell 提供。类名一个不改。

   2026-10-08 夜用户点名改的三处：
     · **回复挂到被回复的那条下面**（原来平铺，只有一枚「回 @谁」小签）→ `buildThreads` ＋ `.msgs-sub`。
     · **删掉留言板邮箱框**（样张有、数据库里没这个字段，只是只读占位）→ `.grow` 只剩昵称一格。
     · 没头像的人一律**昵称首字字面**（本来就有；顺手把顶栏/个人主页的空占位补齐，非本文件）。

   样张里没有、按 N1 语汇补的（见交付报告「缺口清单」）：
     · 两个栏目签（留言区／Bug 反馈）用 `.seg`＋`button`——样张 `novel.html` 505-507 那排分段键的规格
       （`.n1 .seg button`，`n1-app.css` 小说段）。**2026-10-09 修**：原来写成 `.chips`＋`.chip`，
       注释还说是「样张图集页那套签」——图集页根本没有这两个类（样张只有分类色小签 `.mchip`），
       于是这两个签在页面上是**一条样式都没有的裸 <span>**，挤成一行「留言区 0Bug 反馈」，
       既不像按钮也看不出选中（用户原话「留言区 和Bug 反馈按钮有问题」）。
     · 留言的「回复／删除」借 `.mhead` 里的小签位（原本只放 `.mtagme`）。
     · 回复层：`.msgs-sub`（`n1-app.css` 补的一条，样张没有画二级列表）。
     · 上报状态（`.gnote`）、换行靠 `.msgs` 里多行 `.msg`，没有新样式。
   ══════════════════════════════════════════════════════════════════════════════ */

/* 数据库状态常量（与既有数据兼容，不随语言切换） */
const STATUS_OPEN = '待处理';
const STATUS_DONE = '已处理';

/* 昵称外圈那枚「字」（样张是「早」「远」「一」「白」）＝ 昵称首字。
   没名字时用字典兜底字（中文「访」／英文 A）——原来写死「访」，英文页会露汉字。 */
const faceLetter = (name: string, fallback: string) => name.trim().charAt(0) || fallback;

/* 留言板是平表，靠 parentId 把**回复挂到被回复的那条下面**（2026-10-08 用户点名）：
   顶层留言仍按时间倒序；一条留言下的回复平铺成一层（回复的回复也落在同一层，
   前面那枚「回 @谁」说明它答的是谁）——与文章评论 CommentSection 的「一层缩进」同口径，
   窄栏里不会越缩越窄。 */
type MsgNode = { c: Comment; replyTo?: string; replies: MsgNode[] };

/* 往上走到最外层那条留言（父链断掉或成环时就地当顶层） */
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

function buildThreads(list: Comment[]): MsgNode[] {
  const byId = new Map<string, MsgNode>();
  list.forEach((c) => byId.set(c.id, { c, replies: [] }));
  const roots: MsgNode[] = [];
  list.forEach((c) => {
    const node = byId.get(c.id)!;
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    if (!parent) { roots.push(node); return; }   // 顶层留言，或父已被删的孤儿回复
    node.replyTo = c.parentName || parent.c.name;
    const top = topOf(parent, byId);
    if (top === node) { roots.push(node); return; }   // 父链成环 → 就地当顶层，绝不挂到自己身上
    top.replies.push(node);
  });
  return roots;
}

export default function Guestbook() {
  const t = useT();
  const { locale } = useLocale();
  usePageTitle(t('comment.guestbookTitle'));
  const { guestbook, addGuestbook, deleteComment } = useComments();
  const { user, isAdmin } = useAuth();
  const { profile, myProfile } = useProfile();
  const [tab, setTab] = useState<'guestbook' | 'bug'>('guestbook');

  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const [reports, setReports] = useState<BugReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [contentBug, setContentBug] = useState('');
  const [category, setCategory] = useState('bug');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const threads = buildThreads(guestbook);
  const needLogin = !user;

  const loginName = (myProfile?.nickname?.trim() || '');
  const loginAvatar = myProfile?.avatar || '';

  /* 已登录：昵称框显示登录昵称（真提交时服务端按 userId 反查昵称/头像，口径与 CommentSection 一致）。
     2026-10-08 夜：**邮箱那一格按用户要求删掉**（样张画了、数据库里没有这个字段，原本只是只读占位）——
     `.grow` 只剩昵称一格，靠 `n1-app.css` 的 `.grow > :only-child` 铺满整行。 */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    addGuestbook({
      name: loginName || t('comment.anonymous'),
      content: content.trim(),
      parentId: replyingTo?.id,
      parentName: replyingTo?.name,
      avatar: loginAvatar,
    });
    setContent('');
    setReplyingTo(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const canDelete = (c: Comment) => !!user && (isAdmin || (!!c.userId && c.userId === user.id));

  /* Bug 反馈：原 BugFeedback.tsx 的逻辑原样搬进来，只把界面换成 N1 的 .gform/.msgs 语汇 */
  const switchTab = (next: 'guestbook' | 'bug') => {
    setTab(next);
    if (next !== 'bug' || loaded) return;
    supabase
      .from('bug_reports')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setReports(data.map((r) => ({
            id: r.id,
            userId: r.user_id || undefined,
            nickname: r.nickname || t('bug.anonymous'),
            category: r.category || 'other',
            content: r.content,
            status: r.status || t('bug.statusOpen'),
            date: r.date,
          })));
        }
        setLoaded(true);
      });
  };

  const submitBug = (e: FormEvent) => {
    e.preventDefault();
    if (!contentBug.trim()) { setError(t('bug.needContent')); return; }
    setError('');
    const nickname = (myProfile && myProfile.nickname ? myProfile.nickname : '').trim() || t('bug.anonymous');
    const id = 'bug_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const date = new Date().toISOString();
    const row: Record<string, unknown> = {
      id,
      content: contentBug.trim(),
      category,
      status: STATUS_OPEN,
      date,
      nickname,
    };
    if (user) row.user_id = user.id;
    supabase
      .from('bug_reports')
      .insert(row)
      .then(({ error: err }) => {
        if (err) { setError(t('bug.submitFailed') + err.message); return; }
        const newRep: BugReport = {
          id, userId: (user && user.id) || undefined, nickname, category,
          content: contentBug.trim(), status: STATUS_OPEN, date,
        };
        setReports((prev) => [newRep, ...prev]);
        setContentBug('');
        setCategory('bug');
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      });
  };

  const toggleStatus = (rep: BugReport) => {
    const nextStatus = rep.status === STATUS_OPEN ? STATUS_DONE : STATUS_OPEN;
    setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, status: nextStatus } : r)));
    supabase
      .from('bug_reports')
      .update({ status: nextStatus })
      .eq('id', rep.id)
      .then(({ error: err }) => {
        if (err) {
          setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, status: rep.status } : r)));
          setError(t('bug.statusFailed') + err.message);
        } else {
          setError('');
        }
      });
  };

  const canEditBug = (rep: BugReport) => !!user && (isAdmin || rep.userId === user.id);

  /* 一行留言的三件：头像（有图用图、没图用昵称首字）／头行（名字＋回 @谁＋时间＋回复·删除）／正文。
     顶层与回复共用同一套 markup，回复只是多挂一层 `.msgs-sub`。
     ★ 2026-10-09：头像恢复**可点**（用户报「按头像能到个人主页的功能也没有了」）——
     迁移前留言板走 CommentSection，那里头像是 `<Link to={'/profile?userId=' + c.userId}>`
     （title `comment.viewProfile`＝「查看个人主页」）；本页重写时降级成了纯 img/span，这里补回旧口径。 */
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
      <button type="button" className="btn ghost" onClick={() => setReplyingTo(c)}>
        {t('common.reply')}
      </button>
      {canDelete(c) && (
        <button
          type="button"
          className="btn ghost"
          onClick={() => { if (window.confirm(t('comment.deleteConfirm'))) deleteComment(c.id, 'guestbook'); }}
        >
          {t('common.delete')}
        </button>
      )}
    </div>
  );

  /* 顶层留言 = 自己那一行 ＋ 它下面那一层回复 */
  const renderThread = (node: MsgNode) => (
    <li className="msg" key={node.c.id}>
      {face(node.c)}
      <div className="mtxt">
        {head(node.c, node.replyTo)}
        {/* 留言正文走 Markdown（2026-10-09 用户「让留言支持markdown」） */}
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
  );

  return (
    <>
      {/* 页头：照样张 guestbook.html 449-456 */}
      <section className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">GUESTBOOK</div>
          <h1>{t('comment.guestbookTitle')}</h1>
          <p className="lede">
            {t('comment.gbPrefix')}
            {/* 署名跟着语言走（2026-10-09 用户裁决「Suzu Suzukaze」）：英文页不能出现中文昵称 */}
            {locale === 'en' ? t('brand.author') : profile.nickname || t('brand.author')}
            {t('comment.gbSuffix')}
          </p>
        </div>
      </section>

      {/* ① 表单：照样张 457-463（.gform/.grow/textarea/.gfoot） */}
      <section className="sec">
        <div className="seg gb-tabs">
          <button type="button" className={tab === 'guestbook' ? 'on' : ''} onClick={() => switchTab('guestbook')}>
            {t('comment.tabGuestbook')} {guestbook.length}
          </button>
          <button type="button" className={tab === 'bug' ? 'on' : ''} onClick={() => switchTab('bug')}>
            {t('comment.tabBug')}
          </button>
        </div>

        {tab === 'guestbook' ? (
          needLogin ? (
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
          )
        ) : needLogin ? (
          <p className="gnote">{t('bug.needLogin')}</p>
        ) : (
          <form className="gform" onSubmit={submitBug}>
            <div className="grow">
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {BUG_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(`cat.${c.value}` as 'cat.bug')}</option>
                ))}
              </select>
              <span className="gnote">{t('bug.desc')}</span>
            </div>
            <textarea
              placeholder={t('bug.placeholder')}
              value={contentBug}
              onChange={(e) => setContentBug(e.target.value)}
            />
            <div className="gfoot">
              <span className="gnote">{ok ? t('bug.submitted') : ''}</span>
              <button type="submit" className="btn">{t('bug.submit')}</button>
            </div>
            {error && <p className="gnote">{error}</p>}
          </form>
        )}
      </section>

      {/* ② 列表：留言照样张 464-492（.sec-head ＋ .msgs/.msg），Bug 反馈同一套语汇 */}
      {tab === 'guestbook' ? (
        <section className="sec">
          <div className="sec-head">
            <h2>{t('comment.title', { n: guestbook.length })}</h2>
            <small>{t('comment.count', { n: guestbook.length })}</small>
          </div>
          <ul className="msgs">
            {threads.length === 0 && <li className="msg"><span className="gnote">{t('comment.empty')}</span></li>}
            {threads.map(renderThread)}
          </ul>
        </section>
      ) : (
        <section className="sec">
          <div className="sec-head">
            <h2>{t('bug.heading')}</h2>
            <small>{t('comment.count', { n: reports.length })}</small>
          </div>
          <ul className="msgs">
            {reports.length === 0 && <li className="msg"><span className="gnote">{t('bug.empty')}</span></li>}
            {reports.map((rep) => {
              const cat = BUG_CATEGORIES.find((c) => c.value === rep.category);
              const done = rep.status !== STATUS_OPEN;
              return (
                <li className="msg" key={rep.id}>
                  <span className="gface letter">{faceLetter(rep.nickname, t('comment.avatarFallback'))}</span>
                  <div className="mtxt">
                    <div className="mhead">
                      <b>{rep.nickname}</b>
                      <span className="mtagme">{cat ? t(`cat.${cat.value}` as 'cat.bug') : rep.category}</span>
                      <span className="mtime">
                        {done ? t('bug.statusDone') : t('bug.statusOpen')}　{formatDate(rep.date, locale)}
                      </span>
                      {canEditBug(rep) && (
                        <button type="button" className="btn ghost" onClick={() => toggleStatus(rep)}>
                          {done ? t('bug.markOpen') : t('bug.markDone')}
                        </button>
                      )}
                    </div>
                    <p>{rep.content}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
