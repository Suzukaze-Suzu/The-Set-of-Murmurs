import { useState, FormEvent, ChangeEvent, DragEvent, useRef } from 'react';
import { useFriendLinks } from '../context/FriendLinkContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

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
    if (!/^image\//.test(file.type)) { setErr('请选择图片文件'); return; }
    setAvatarUploading(true);
    setErr('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = 'friendlink/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
      if (error) { setErr('图标上传失败：' + error.message); return; }
      const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
      setDraft((d) => ({ ...d, avatar: pub.publicUrl }));
    } catch (e) {
      setErr('图标上传异常：' + (e instanceof Error ? e.message : String(e)));
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
    if (!draft.name.trim() || !draft.url.trim()) { setErr('请填写站点名称和网址'); return; }
    setBusy(true);
    setErr('');
    const ok = editingId
      ? await updateFriend(editingId, { name: draft.name, url: draft.url, desc: draft.desc, avatar: draft.avatar })
      : await addFriend({ name: draft.name, url: draft.url, desc: draft.desc, avatar: draft.avatar });
    setBusy(false);
    if (ok) { setShowForm(false); flash(editingId ? '友链已更新' : '友链已添加'); }
    else setErr('操作失败，请重试');
  };

  const onDelete = async (id: string) => {
    const ok = await deleteFriend(id);
    if (ok) flash('友链已删除');
  };

  return (
    <div className="page friends-page">
      <div className="friends-head card">
        <h1 className="page-title">{t('friends.heading')}</h1>
        <p className="friends-desc">{t('friends.desc')}</p>
        {isAdmin && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ 添加友链</button>
        )}
      </div>

      {showForm && isAdmin && (
        <form className="friends-form card" onSubmit={submit}>
          <h3>{editingId ? '编辑友链' : '添加友链'}</h3>
          <label>站点名称 *</label>
          <input className="gallery-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="站名，如：呓语集" />
          <label>网址 *</label>
          <input className="gallery-input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://example.com" />
          <label>一句话描述（可选）</label>
          <input className="gallery-input" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} placeholder="用一句话介绍这个站点" />
          <label>图标（可选）· 拖入本地图片上传，或点击选择</label>
          <div
            style={{
              border: '2px dashed ' + (avatarDrag ? '#c89f6b' : '#e0d5c3'),
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
              cursor: 'pointer',
              background: avatarDrag ? 'rgba(200,159,107,0.10)' : '#faf6ee',
              transition: 'all .15s',
              marginBottom: 8,
              minHeight: 88,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onDragOver={(e) => { e.preventDefault(); setAvatarDrag(true); }}
            onDragLeave={() => setAvatarDrag(false)}
            onDrop={onDrop}
            onClick={() => avatarInput.current?.click()}
          >
            {avatarUploading ? (
              <span style={{ color: '#8a6f4f' }}>正在上传图标…</span>
            ) : draft.avatar ? (
              <img src={draft.avatar} alt="图标预览" style={{ maxWidth: 72, maxHeight: 72, objectFit: 'contain', borderRadius: 8 }} />
            ) : (
              <span style={{ color: '#b39a7c' }}>＋ 拖入本地图片上传，或点击选择</span>
            )}
          </div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e: ChangeEvent<HTMLInputElement>) => { uploadAvatar(e.target.files?.[0]); e.target.value = ''; }}
          />
          <label>图标图片地址（可选，不想上传时可直接填写）</label>
          <input className="gallery-input" value={draft.avatar} onChange={(e) => setDraft({ ...draft, avatar: e.target.value })} placeholder="https://example.com/logo.png" />
          {err && <p className="gallery-error">{err}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || avatarUploading}>{busy ? '保存中…' : '保存'}</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </form>
      )}

      {msg && <p className="friends-msg">{msg}</p>}

      {loading ? (
        <div className="about-loading"><span className="about-loading-spin"/><p>{t('friends.loading')}</p></div>
      ) : friends.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-ghost" />
          <p>{t('friends.none')}</p>
        </div>
      ) : (
        <div className="friends-grid">
          {friends.map((f) => (
            <div key={f.id} className="friends-card card">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="friends-main">
                <span className="friends-avatar">
                  {f.avatar ? <img src={f.avatar} alt="" loading="lazy" /> : <span className="friends-avatar-ph">{initials(f.name, t('friends.title').charAt(0))}</span>}
                </span>
                <span className="friends-info">
                  <span className="friends-name">{f.name}</span>
                  {f.desc && <span className="friends-desc-text">{f.desc}</span>}
                </span>
              </a>
              {isAdmin && (
                <span className="friends-ops">
                  <button className="friend-op" onClick={() => openEdit(f.id)}>编辑</button>
                  <button className="friend-op friend-op-del" onClick={() => onDelete(f.id)}>删除</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}