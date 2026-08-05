import { useState, ChangeEvent, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import AvatarCropModal from '../components/AvatarCropModal';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { myProfile, setMyProfile } = useProfile();
  const { user } = useAuth();

  const avatarInput = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState(myProfile?.nickname || '');
  const [signature, setSignature] = useState(myProfile?.signature || '');
  const [intro, setIntro] = useState(myProfile?.intro || '');
  const [cropImage, setCropImage] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon empty-icon-ghost" />
          <p>请先登录，才能查看和编辑你的个人主页。</p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>去登录</button>
        </div>
      </div>
    );
  }

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const enterEdit = () => {
    setNickname(myProfile?.nickname || '');
    setSignature(myProfile?.signature || '');
    setIntro(myProfile?.intro || '');
    setEditMode(true);
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const p = {
      nickname: nickname.trim() || '未命名用户',
      avatar: myProfile?.avatar || '',
      signature: signature.trim(),
      intro: intro.trim(),
    };
    if (myProfile) setMyProfile({ ...myProfile, ...p });
    setEditMode(false);
  };

  const display = myProfile;

  return (
    <div className="page profile-page">
      <h1 className="page-title">我的主页</h1>

      <div className="profile-card" style={{ alignSelf: 'auto', textAlign: 'center' }}>
        <div className="profile-avatar">
          {display?.avatar ? <img src={display.avatar} alt="头像" /> : <span className="avatar-placeholder">👤</span>}
        </div>
        <h2 className="profile-name">{display?.nickname || '未命名用户'}</h2>
        <p className="profile-signature">{display?.signature || '这个人很懒，还没有签名'}</p>
        <p className="profile-intro" style={{ whiteSpace: 'pre-wrap' }}>{display?.intro || '还没有填写介绍…'}</p>
        <div className="form-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
          {!editMode ? (
            <button className="btn btn-primary" onClick={enterEdit}>编辑资料</button>
          ) : (
            <button className="btn" onClick={() => setEditMode(false)}>取消</button>
          )}
        </div>
      </div>

      {editMode && (
        <form className="edit-profile card" onSubmit={saveProfile}>
          <h3>编辑个人主页</h3>
          <button type="button" className="avatar-upload-btn" onClick={() => avatarInput.current?.click()}>
            {display?.avatar ? <img src={display.avatar} alt="头像" /> : <span className="avatar-upload-hint">＋<small>头像</small></span>}
          </button>
          <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
          <label>昵称</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <label>个性签名</label>
          <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} />
          <label>个人介绍</label>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={4} />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">保存</button>
            <button type="button" className="btn" onClick={() => setEditMode(false)}>取消</button>
          </div>
        </form>
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
    </div>
  );
}
