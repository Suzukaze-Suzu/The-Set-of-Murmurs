import { useState, FormEvent } from 'react';
import { useFriendLinks } from '../context/FriendLinkContext';
import { useAuth } from '../context/AuthContext';

interface Draft {
  name: string;
  url: string;
  desc: string;
  avatar: string;
}

const emptyDraft: Draft = { name: '', url: '', desc: '', avatar: '' };

function initials(name: string) {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '友';
}

export default function Friends() {
  const { friends, loading, addFriend, updateFriend, deleteFriend } = useFriendLinks();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
        <h1 className="page-title">友情链接</h1>
        <p className="friends-desc">记录与我互相关注、相互链接的小伙伴们，欢迎交换友链～</p>
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
          <label>图标图片地址（可选）</label>
          <input className="gallery-input" value={draft.avatar} onChange={(e) => setDraft({ ...draft, avatar: e.target.value })} placeholder="https://example.com/logo.png" />
          {err && <p className="gallery-error">{err}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </form>
      )}

      {msg && <p className="friends-msg">{msg}</p>}

      {loading ? (
        <div className="about-loading"><span className="about-loading-spin"/><p>正在加载友链…</p></div>
      ) : friends.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-ghost" />
          <p>还没有友链，等你来添加～</p>
        </div>
      ) : (
        <div className="friends-grid">
          {friends.map((f) => (
            <div key={f.id} className="friends-card card">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="friends-main">
                <span className="friends-avatar">
                  {f.avatar ? <img src={f.avatar} alt="" loading="lazy" /> : <span className="friends-avatar-ph">{initials(f.name)}</span>}
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