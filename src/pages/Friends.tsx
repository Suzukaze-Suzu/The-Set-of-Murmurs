import { useState, FormEvent, ChangeEvent, DragEvent, useRef } from 'react';
import { useFriendLinks } from '../context/FriendLinkContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

/* ══════════════════════════════════════════════════════════════════════════════
   友链页（2026-10-11「友链被忘记了」）
   ──────────────────────────────────────────────────────────────────────────────
   用户原话只有五个字：「**友链被忘记了**」。反查出的三处缺口（见
   `blog\first\n1-friends\本轮计划书.md` §1）里，这一页是第三处：
   `/friends` 是全站最后一页「N1 报头报尾 ＋ 旧三层页身」的混血页。
   本轮把页身改用样张零件拼（样张六页里**没有**友链页）：

     · `.pagehead`(.pagehead-txt/.kicker/h1/.lede)  ← 照样张 guestbook.html 476-483
     · `.sec` ＋ `.sec-head`(h2 ＋ small)          ← 照样张（版次号由 n1.css 的计数器出）
     · `.flinks`(.fcard/.fcard-ico/.fcard-txt)     ← 样张里没有「友链网格」这一件，
                                                     最小补件写在 `n1-app.css` ⑯ 段，
                                                     **只用 N1 token、不新增颜色**
     · 博主表单套 `.gform`(.grow/.gfoot/.gnote/.btn) ← 照样张 guestbook.html 485-489

   **功能一条没删**：列表／空态／加载态／「＋ 添加友链」／编辑／删除／
   图标拖入上传或直填地址／图标预览／闪信，逐条保留（原 `.friends-*` 那一套结构消失，
   行为不动）。文案改走字典 `friends.*`（这些键早就建好了，此前一直没用上）。
   博主后台的输入框与按钮仍按既有裁决保持中文。
   ══════════════════════════════════════════════════════════════════════════════ */

interface Draft {
  name: string;
  url: string;
  desc: string;
  avatar: string;
}

const emptyDraft: Draft = { name: '', url: '', desc: '', avatar: '' };

/* 图标占位字＝站名首字母；没有站名时退回「友」（英文页退回 Friends 的首字母 F） */
function initials(name: string, fallback: string) {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : fallback;
}

export default function Friends() {
  const t = useT();
  usePageTitle(t('friends.title'));
  const { friends, loading, addFriend, updateFriend, deleteFriend } = useFriendLinks();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDrag, setAvatarDrag] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const openAdd = () => { setDraft(emptyDraft); setEditingId(null); setErr(''); setShowForm(true); };
  const openEdit = (id: string) => {
    const f = friends.find((x) => x.id === id);
    if (!f) return;
    setDraft({ name: f.name, url: f.url, desc: f.desc || '', avatar: f.avatar || '' });
    setEditingId(id);
    setErr('');
    setShowForm(true);
  };

  // 友链图标：拖入或选择本地图片 → 上传到 articles bucket 的 friendlink/ → 取 publicUrl 填入 avatar
  const uploadAvatar = async (file: File | null | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setErr(t('common.chooseImageFile')); return; }
    setAvatarUploading(true);
    setErr('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = 'friendlink/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
      if (error) { setErr(t('friends.iconFail') + error.message); return; }
      const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
      setDraft((d) => ({ ...d, avatar: pub.publicUrl }));
    } catch (e) {
      setErr(t('friends.iconErr') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAvatarUploading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setAvatarDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadAvatar(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.url.trim()) { setErr(t('friends.needNameUrl')); return; }
    setBusy(true);
    setErr('');
    const ok = editingId
      ? await updateFriend(editingId, { name: draft.name, url: draft.url, desc: draft.desc, avatar: draft.avatar })
      : await addFriend({ name: draft.name, url: draft.url, desc: draft.desc, avatar: draft.avatar });
    setBusy(false);
    if (ok) { setShowForm(false); flash(editingId ? t('friends.updated') : t('friends.added')); }
    else setErr(t('friends.saveFail'));
  };

  const onDelete = async (id: string) => {
    const ok = await deleteFriend(id);
    if (ok) flash(t('friends.deleted'));
  };

  return (
    <>
      {/* ===== ① 页头：照样张 guestbook.html 476-483（.pagehead）
            kicker 用拉丁词（样张 `GUESTBOOK` 同口径，中英同形）；
            h1／提要 中英各走字典，不再整页露中文。 ===== */}
      <section className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">FRIENDS</div>
          <h1>{t('friends.heading')}</h1>
          <p className="lede">{t('friends.desc')}</p>
        </div>
      </section>

      {/* ===== ② 博主表单：照样张 `.gform` 骨架（样张里没有这块，用样张零件拼）=====
           四个字段（站名／网址／描述／图标地址）＋ 图标拖入区，一条功能都没少。 */}
      {showForm && isAdmin && (
        <section className="sec">
          <div className="sec-head">
            <h2>{editingId ? t('friends.edit') : t('friends.add')}</h2>
            <small>LINK</small>
          </div>
          <form className="gform" onSubmit={submit}>
            <div className="grow">
              <label>{t('friends.siteName')}
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="站名，如：呓语集" />
              </label>
              <label>{t('friends.siteUrl')}
                <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://example.com" />
              </label>
              <label>{t('friends.siteDesc')}
                <input value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} placeholder={t('friends.siteDescPlaceholder')} />
              </label>
              <label>{t('friends.iconUrl')}
                <input value={draft.avatar} onChange={(e) => setDraft({ ...draft, avatar: e.target.value })} placeholder="https://example.com/logo.png" />
              </label>
            </div>

            {/* 图标：拖入本地图片上传，或点击选择（点了直接上传，行为与改造前一致） */}
            <label className="fgrow-label">{t('friends.icon')}</label>
            <div
              className={'fdrop' + (avatarDrag ? ' on' : '')}
              onDragOver={(e) => { e.preventDefault(); setAvatarDrag(true); }}
              onDragLeave={() => setAvatarDrag(false)}
              onDrop={onDrop}
              onClick={() => avatarInput.current?.click()}
            >
              {avatarUploading ? (
                <span>{t('friends.iconUploading')}</span>
              ) : draft.avatar ? (
                <img src={draft.avatar} alt={t('friends.iconPreview')} />
              ) : (
                <span>{t('friends.iconDrop')}</span>
              )}
            </div>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { uploadAvatar(e.target.files?.[0]); e.target.value = ''; }}
            />

            <div className="gfoot">
              <span className="gnote">{err}</span>
              <button className="btn" type="submit" disabled={busy || avatarUploading}>
                {busy ? t('friends.saving') : t('friends.save')}
              </button>
              <button className="btn ghost" type="button" onClick={() => setShowForm(false)}>{t('friends.cancel')}</button>
            </div>
          </form>
        </section>
      )}

      {/* ===== ③ 友链列表：`.sec` ＋ `.sec-head` ＋ `.flinks` ===== */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('friends.listTitle')}</h2>
          <small>{friends.length} LINKS</small>
        </div>

        {msg && <p className="fmsg">{msg}</p>}
        {!showForm && err && <p className="fmsg">{err}</p>}

        {isAdmin && !showForm && (
          <p className="sec-ops">
            <button className="btn" onClick={openAdd}>{t('friends.add')}</button>
          </p>
        )}

        {loading ? (
          <p className="gnote">{t('friends.loading')}</p>
        ) : friends.length === 0 ? (
          <p className="gnote">{t('friends.none')}</p>
        ) : (
          <div className="flinks">
            {friends.map((f) => (
              <article className="fcard" key={f.id}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="fcard-main">
                  <span className="fcard-ico">
                    {f.avatar
                      ? <img src={f.avatar} alt="" loading="lazy" />
                      : <i>{initials(f.name, t('friends.title').charAt(0))}</i>}
                  </span>
                  <span className="fcard-txt">
                    <b>{f.name}</b>
                    {f.desc && <span>{f.desc}</span>}
                  </span>
                </a>
                {isAdmin && (
                  <span className="fcard-ops">
                    <button className="btn ghost" onClick={() => openEdit(f.id)}>{t('friends.editBtn')}</button>
                    <button className="btn ghost" onClick={() => onDelete(f.id)}>{t('friends.deleteBtn')}</button>
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
