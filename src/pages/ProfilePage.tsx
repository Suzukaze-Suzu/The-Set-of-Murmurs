import { useState, ChangeEvent, useRef, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useArticles } from '../context/ArticleContext';
import { supabase } from '../lib/supabase';
import AvatarCropModal from '../components/AvatarCropModal';
import { Profile } from '../types';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale, formatDate } from '../i18n';

/* ══════════════════════════════════════════════════════════════════════════════
   个人主页（2026-10-09「登录，个人主页和翻译界面未统一风格」）
   ──────────────────────────────────────────────────────────────────────────────
   页身从旧皮肤（`.page profile-page` ＋圆角卡＋投影＋渐变头带）换成 N1 样张的语汇：
     `.pagehead`  页头（kicker ＋ 大标题）
     `.prof`      头像格（92px 细线圆 ＋ 衬线名字 ＋ 签名 ＋ 动作行）—— 样张没有这一件，
                  落 `n1-app.css` 第⑤段，只用现有 token
     `.sec-head`  区块题头（自动「第 N 版」计数）
     `.facts`     档案表（关于页那套 dt/dd 细线表）
     `.gform`     编辑表单（留言板那套）
   逻辑一行未改：取访客资料、编辑态、头像裁剪、保存路径全部照旧。
   回退＝删掉 n1Routes 里的 '/profile' 一行，页身即可回旧皮肤（旧 CSS 一行未删）。

   ── 2026-10-09 第二轮「可读性」（用户「登录页和个人主页可读性不强」）────────────
   用户六题拍板：只治这两页；格子左上方加一行小字标签；补一张档案表；介绍放大去两端对齐；
   未登录出一屏空态。本文件相应加了四件：
     ① `.pagehead-prof`（大标题由 `n1-app.css` 收到 ~52px）
     ② 编辑表单加 `gform-prof` ＋ 三行 `.glabel`（原来只有 placeholder，打字后分不清哪格是哪格）
     ③ 档案表 `.facts prof-facts`：**按「拿得到数据才显示一行」生成**（见下面 factRows）
     ④ 未登录空态（原来这一页只剩一个大标题，等于白屏）
   回退＝删掉 ①②③④ 四处标记 ＋ `n1-app.css` 第⑥段。
   ══════════════════════════════════════════════════════════════════════════════ */

export default function ProfilePage() {
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get('userId') || null;

  const { myProfile, setMyProfile } = useProfile();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { articles, loaded: articlesLoaded } = useArticles();

  const isSelf = !viewUserId || (!!user && viewUserId === user.id);

  usePageTitle(viewUserId && !isSelf ? t('profile.pageTitleGuest') : t('profile.pageTitleSelf'));

  const avatarInput = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState('');
  const [signature, setSignature] = useState('');
  const [intro, setIntro] = useState('');
  const [cropImage, setCropImage] = useState<string | null>(null);

  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const display = isSelf ? (myProfile || null) : viewProfile;

  useEffect(() => {
    if (isSelf || !viewUserId) { setViewProfile(null); setViewLoading(false); return; }
    let mounted = true;
    setViewLoading(true);
    setViewProfile(null);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', viewUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          setViewProfile({
            nickname: data.nickname || t('profile.unnamed'),
            avatar: data.avatar || '',
            signature: data.signature || '',
            intro: data.intro || '',
          });
        } else {
          setViewProfile({ nickname: t('profile.unnamed'), avatar: '', signature: '', intro: '' });
        }
        setViewLoading(false);
      });
    return () => { mounted = false; };
  }, [viewUserId, isSelf]);

  /* ── 档案表的补数据（2026-10-09）────────────────────────────────────────────
     昵称与签名页面上已经有了，这里只补**算得出来**的那三样：
       ① 身份 ＝ `profiles.role`（实测值 admin＝博主、user＝读者）
       ② 留言 ＝ `comments` ＋ `guestbook` 按 `user_id` 的计数（两表都拿得到才算）
       ③ 加入 ＝ **本人会话**里的 `user.created_at`（访客态数据库里查不到这一列 —— 没有就不出这一行）
     ④ 文章 ＝ 全站总数（`articles` 表**没有作者列**，所以只有博主主页出这一行）
     ⚠️ 任何一条拿不到就**不显示那一行**，绝不拿 0 冒充（本机 node 侧连不上 Supabase 是常态）。 */
  const [role, setRole] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState<number | null>(null);

  useEffect(() => {
    const id = viewUserId || user?.id || null;
    setRole(null); setMsgCount(null);
    if (!id) return;
    let alive = true;
    (async () => {
      const [p, c, g] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', id).maybeSingle(),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', id),
        supabase.from('guestbook').select('id', { count: 'exact', head: true }).eq('user_id', id),
      ]);
      if (!alive) return;
      const r = (p.data as { role?: string } | null)?.role;
      if (r) setRole(r);
      const counts = [c.count, g.count].filter((n): n is number => typeof n === 'number');
      if (counts.length) setMsgCount(counts.reduce((a, b) => a + b, 0));
    })();
    return () => { alive = false; };
  }, [viewUserId, user?.id]);

  const enterEdit = () => {
    setNickname(display?.nickname || '');
    setSignature(display?.signature || '');
    setIntro(display?.intro || '');
    setEditMode(true);
  };

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const p = {
      nickname: nickname.trim() || t('profile.unnamed'),
      avatar: myProfile?.avatar || display?.avatar || '',
      signature: signature.trim(),
      intro: intro.trim(),
    };
    if (myProfile) setMyProfile({ ...myProfile, ...p });
    setEditMode(false);
  };

  const title = isSelf ? t('profile.headingSelf') : t('profile.headingGuest');
  const initial = (display?.nickname || '').trim().charAt(0) || t('comment.avatarFallback');

  /* 档案表的行：按「拿得到数据才显示一行」现算（见上面那段说明与计划书第三节）。
     「博主」判定取「会话里的 isAdmin **或** 库里读到的 role」——两条都拿不到就不出这两行，
     免得 Supabase 抖动时把博主的档案表降级成读者。 */
  const isAuthor = isAdmin || role === 'admin';
  const factRows: Array<[string, string]> = [];
  if (display) factRows.push([t('profile.factName'), display.nickname || t('profile.unnamed')]);
  if (isAuthor || role) {
    factRows.push([t('profile.factRole'), isAuthor ? t('profile.roleAdmin') : t('profile.roleUser')]);
  }
  if (isSelf && user?.created_at) {
    factRows.push([t('profile.factJoined'), formatDate(user.created_at.slice(0, 10), locale)]);
  }
  if (isAuthor && articlesLoaded) {
    factRows.push([t('profile.factPosts'), t('count.posts', { n: articles.length })]);
  }
  if (msgCount !== null) factRows.push([t('profile.factComments'), t('count.messages', { n: msgCount })]);

  return (
    <>
      <section className="pagehead pagehead-prof">
        <div className="pagehead-txt">
          <div className="kicker">PROFILE</div>
          <h1>{title}</h1>
        </div>
      </section>

      {!isSelf && viewLoading && (
        <section className="sec">
          <p className="gnote">{t('profile.loading')}</p>
        </section>
      )}

      {/* 未登录空态（2026-10-09 用户拍板）：改前这一页 `isSelf && user` 两道门全关 → 只剩一个
          68px 大标题，等于白屏。复用 `.prof-bio` / `.prof-acts`，不新增样式。
          `authLoading` 那道是为了别在会话还没读出来时先闪一下空态。 */}
      {isSelf && !user && !authLoading && (
        <section className="sec">
          <p className="prof-bio">{t('profile.needSignIn')}</p>
          <p className="prof-acts">
            <button className="btn" onClick={() => navigate('/login')}>{t('profile.goSignIn')}</button>
          </p>
        </section>
      )}

      {((isSelf && user) || (!isSelf && !viewLoading)) && (
        <section className="sec">
          {/* 头像格：没设头像＝昵称首字（2026-10-08 用户点名的口径，这里照旧，只换成 N1 的圆） */}
          <div className="prof">
            <div className="prof-face">
              {display?.avatar
                ? <img src={display.avatar} alt={t('profile.avatar')} />
                : <span>{initial}</span>}
            </div>
            <div className="prof-txt">
              <h2 className="prof-name">{display?.nickname || t('profile.unnamed')}</h2>
              <p className="prof-sign">{display?.signature || t('profile.noSignature')}</p>
              <p className="prof-acts">
                {isSelf && user && (
                  !editMode
                    ? <button className="btn" onClick={enterEdit}>{t('profile.editBtn')}</button>
                    : <button className="btn" onClick={() => setEditMode(false)}>{t('profile.cancel')}</button>
                )}
                {!isSelf && (
                  <button className="btn" onClick={() => navigate('/')}>{t('profile.backHome')}</button>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {((isSelf && user) || (!isSelf && !viewLoading)) && (
        <section className="sec">
          <div className="sec-head"><h2>{t('profile.introLabel')}</h2><small>ABOUT</small></div>
          <p className="prof-bio">{display?.intro || t('profile.noIntro')}</p>
        </section>
      )}

      {/* 档案表（2026-10-09 新增）：关于页那套 `.facts`，这里收成一栏。
          原来整页只有头像＋名字＋签名＋一段介绍，下面一大片留白；这张表把空页补成报纸栏目，
          同时把「身份／加入／文章／留言」这些只能算出来的信息摆出来。 */}
      {((isSelf && user) || (!isSelf && !viewLoading)) && factRows.length > 0 && (
        <section className="sec">
          <div className="sec-head"><h2>{t('profile.secArchive')}</h2><small>ARCHIVE</small></div>
          <dl className="facts prof-facts">
            {factRows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {/* 编辑态：留言板那套 `.gform`（细下划线输入框 ＋ `.gfoot` 动作行） */}
      {isSelf && user && editMode && (
        <section className="sec">
          <div className="sec-head"><h2>{t('profile.editHeading')}</h2><small>EDIT</small></div>
          <form className="gform gform-prof" onSubmit={saveProfile}>
            <button type="button" className="avatar-upload-btn" onClick={() => avatarInput.current?.click()}>
              {display?.avatar
                ? <img src={display.avatar} alt={t('profile.avatar')} />
                : <span className="avatar-upload-hint">＋<small>{t('profile.avatar')}</small></span>}
            </button>
            <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />

            {/* 三格各挂一行标签（`.glabel`，2026-10-09 用户拍板 A）：原来只有 placeholder，
                打字后分不清哪格是昵称、哪格是签名；标签一在，placeholder 就退场了。 */}
            <div className="grow">
              <div className="fld">
                <label className="glabel" htmlFor="prof-nickname">{t('profile.lblNickname')}</label>
                <input
                  id="prof-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="fld">
                <label className="glabel" htmlFor="prof-signature">{t('profile.lblSignature')}</label>
                <input
                  id="prof-signature"
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>
            </div>
            <div className="fld">
              <label className="glabel" htmlFor="prof-intro">{t('profile.lblIntro')}</label>
              <textarea
                id="prof-intro"
                className="tall"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={4}
              />
            </div>
            <div className="gfoot">
              <button type="button" className="tbtn" onClick={() => setEditMode(false)}>{t('profile.cancel')}</button>
              <button type="submit" className="btn">{t('profile.save')}</button>
            </div>
          </form>
        </section>
      )}

      <AvatarCropModal
        open={!!cropImage}
        imageSrc={cropImage}
        onCancel={() => setCropImage(null)}
        onConfirm={(cropped) => {
          if (myProfile) setMyProfile({ ...myProfile, avatar: cropped });
          else setMyProfile({ nickname: '', avatar: cropped, signature: '', intro: '' });
          setCropImage(null);
        }}
      />
    </>
  );
}
