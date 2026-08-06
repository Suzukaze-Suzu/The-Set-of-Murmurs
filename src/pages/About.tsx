import { useState, ChangeEvent, useRef, FormEvent } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useAbout } from '../context/AboutContext';
import ProfileCard from '../components/ProfileCard';
import AvatarCropModal from '../components/AvatarCropModal';
import MarkdownRenderer from '../components/MarkdownRenderer';

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function About() {
  const { profile, setProfile } = useProfile();
  const { isAdmin } = useAuth();
  const { current, versions, saving, save, loadVersion, rollback, reset } = useAbout();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [signature, setSignature] = useState(profile.signature);
  const [intro, setIntro] = useState(profile.intro);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropImage(String(reader.result)); };
    reader.readAsDataURL(file);
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfile({ ...profile, nickname, signature, intro });
    setEditMode(false);
    setMsg('资料已保存');
    setTimeout(() => setMsg(''), 2500);
  };

  const openEdit = () => { setEditText(current); setPreviewing(false); setEditMode(true); };
  const saveIntro = async () => {
    try {
      await save(editText);
      setEditMode(false);
      setMsg('简介已保存，已生成新版本');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const doRollback = async (id: string) => {
    if (!window.confirm('将把该历史版本设为当前简介，并生成一条新版本记录。确定吗？')) return;
    await rollback(id);
    setShowHistory(false);
    setMsg('已恢复该版本');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="page about-page">
      <h1 className="page-title">关于本站</h1>

      <div className="about-grid">
        <ProfileCard />

        <div className="about-content card">
          {editMode ? (
            <>
              <div className="about-edit-head">
                <h2>编辑本站简介</h2>
                <div className="about-preview-tabs">
                  <button className={'tab-btn ' + (previewing ? '' : 'active')} onClick={() => setPreviewing(false)}>编辑</button>
                  <button className={'tab-btn ' + (previewing ? 'active' : '')} onClick={() => setPreviewing(true)}>预览</button>
                </div>
              </div>
              {previewing ? (
                <div className="editor-preview"><MarkdownRenderer content={editText} /></div>
              ) : (
                <textarea className="editor-textarea about-editor" value={editText} onChange={(e) => setEditText(e.target.value)} rows={16} placeholder={'支持 Markdown：\n## 标题\n正文…\n\n### 小标题\n更多内容'} />
              )}
              <div className="about-actions">
                <button className="btn btn-primary" onClick={saveIntro}>{saving ? '保存中…' : '保存并生成新版本'} </button>
                <button className="btn" onClick={() => setEditMode(false)}>取消</button>
              </div>
            </>
          ) : (
            <>
              <div className="about-content-head">
                <h2>本站简介</h2>
                {isAdmin && (
                <div className="about-head-actions">
                  <button className="btn btn-light btn-sm" onClick={() => setShowHistory(true)}>历史版本({versions.length})</button>
                  <button className="btn btn-primary btn-sm" onClick={openEdit}>编辑简介</button>
                </div>
                )}
              </div>
              <div className="about-render"><MarkdownRenderer content={current} /></div>
            </>
          )}

          {msg && <p className="about-msg">{msg}</p>}

          {/* 配色装饰（固定） */}
          <div className="color-palette">
            <span style={{ background: '#5BA8D8' }} title="天空蓝" />
            <span style={{ background: '#E8C9A0' }} title="蜜金" />
            <span style={{ background: '#E89B8A' }} title="珊瑚粉" />
            <span style={{ background: '#4A9BB8' }} title="青蓝" />
            <span style={{ background: '#8A8F9A' }} title="灰蓝" />
            <span style={{ background: '#2F6B4F' }} title="森林绿" />
          </div>
        </div>
      </div>

      {/* 编辑个人资料（仅博主可见） */}
      {isAdmin && (
      <div className="edit-profile card">
          {editMode ? (
          <form onSubmit={saveProfile}>
            <h3>编辑个人资料</h3>
            <button type="button" className="avatar-upload-btn" onClick={() => avatarInput.current?.click()}>
              {profile.avatar ? <img src={profile.avatar} alt="头像" /> : <span className="avatar-upload-hint">＋<small>头像</small></span>}
            </button>
            <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
            <label>昵称</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <label>签名</label>
            <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} />
            <label>介绍</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={4} />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">保存</button>
              <button type="button" className="btn" onClick={() => setEditMode(false)}>取消</button>
            </div>
          </form>
        ) : (
          <div className="profile-controls">
            <h3>个人资料管理</h3>
            <p>你可以在这里上传头像、修改昵称、签名与介绍。</p>
            <button className="btn btn-primary" onClick={() => setEditMode(true)}>编辑个人资料</button>
          </div>
        )}
      </div>
      )}

      {showHistory && (
        <div className="modal-overlay about-history-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal about-history-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHistory(false)}>×</button>
            <h3 className="modal-title">简介修改历史</h3>
            <p className="history-hint">点击「预览」查看某个版本，点击「设为当前」回滚到该版本。</p>
            <div className="history-list">
              {versions.length === 0 ? (
                <p className="empty-tip">还没有历史版本。</p>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="history-item">
                    <div className="history-item-info">
                      <span className="history-badge">{i === 0 ? '当前' : '版本 ' + (i + 1)}</span>
                      <span className="history-date">{fmt(v.date)}</span>
                    </div>
                    <div className="history-actions">
                      <button className="btn btn-light btn-sm" onClick={() => loadVersion(v.id)}>预览</button>
                      <button className="btn btn-primary btn-sm" onClick={() => doRollback(v.id)}>设为当前</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {versions.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={() => reset()}>回到当前版本预览</button>
            )}
          </div>
        </div>
      )}

      <AvatarCropModal
        open={!!cropImage}
        imageSrc={cropImage}
        onCancel={() => setCropImage(null)}
        onConfirm={(cropped) => {
          setProfile({ ...profile, avatar: cropped });
          setCropImage(null);
        }}
      />
    </div>
  );
}
