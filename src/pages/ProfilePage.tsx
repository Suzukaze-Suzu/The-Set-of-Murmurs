import { useState, ChangeEvent, useRef, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AvatarCropModal from '../components/AvatarCropModal';
import { Profile } from '../types';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get('userId') || null;

  const { myProfile, setMyProfile } = useProfile();
  const { user } = useAuth();

  const isSelf = !viewUserId || (!!user && viewUserId === user.id);

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
            nickname: data.nickname || '未命名用户',
            avatar: data.avatar || '',
            signature: data.signature || '',
            intro: data.intro || '',
          });
        } else {
          setViewProfile({ nickname: '未命名用户', avatar: '', signature: '', intro: '' });
        }
        setViewLoading(false);
      });
    return () => { mounted = false; };
  }, [viewUserId, isSelf]);

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
      nickname: nickname.trim() || '未命名用户',
      avatar: myProfile?.avatar || display?.avatar || '',
      signature: signature.trim(),
      intro: intro.trim(),
    };
    if (myProfile) setMyProfile({ ...myProfile, ...p });
    setEditMode(false);
  };

  const title = isSelf ? '我的主页' : 'TA 的主页';

  return (
    <div className="page profile-page">
      <h1 className="page-title">{title}</h1>

      {!isSelf && viewLoading && (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <span className="empty-icon empty-icon-ghost" />
          <p>正在加载 TA 的主页…</p>
        </div>
      )}

      {((isSelf && user) || (!isSelf && !viewLoading)) && (
      <div className="profile-card" style={{ alignSelf: 'auto', textAlign: 'center' }}>
        <div className="profile-avatar">
          {display?.avatar ? <img src={display.avatar} alt="头像" /> : <span className="avatar-placeholder">👤</span>}
        </div>
        <h2 className="profile-name">{display?.nickname || '未命名用户'}</h2>
        <p className="profile-signature">{display?.signature || '这个人很懒，还没有签名'}</p>
        <p className="profile-intro" style={{ whiteSpace: 'pre-wrap' }}>{display?.intro || '还没有填写介绍…'}</p>
        {isSelf && user ? (
          <div className="form-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
            {!editMode ? (
              <button className="btn btn-primary" onClick={enterEdit}>编辑资料</button>
            ) : (
              <button className="btn" onClick={() => setEditMode(false)}>取消</button>
            )}
          </div>
        ) : !isSelf && (
          <div className="form-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="btn" onClick={() => navigate('/')}>返回首页</button>
          </div>
        )}
      </div>
      )}

      {isSelf && user && editMode && (
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
