import { useState, ChangeEvent, useRef, FormEvent } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import ProfileCard from '../components/ProfileCard';
import AvatarCropModal from '../components/AvatarCropModal';

export default function About() {
  const { profile, setProfile } = useProfile();
  const { isAdmin } = useAuth();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [signature, setSignature] = useState(profile.signature);
  const [intro, setIntro] = useState(profile.intro);
  const [cropImage, setCropImage] = useState<string | null>(null);

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfile({ ...profile, nickname, signature, intro });
    setEditMode(false);
  };

  return (
    <div className="page about-page">
      <h1 className="page-title">关于本站</h1>

      <div className="about-grid">
        <ProfileCard />

        <div className="about-content card">
          <h2>关于「呓语集」</h2>
          <p>
            呓语集是一个用来记录 <strong>动漫</strong>、<strong>随笔</strong>、<strong>读后感</strong>、
            <strong>数学笔记</strong> 与 <strong>学习分享</strong> 的个人博客。
          </p>
          <p>
            名字取自「呓语」，意喻着那些在心底呢喃、看似零碎却真实的想法。
            正如凉风凉那样——外冷内热，嘴上敷衍，心里却格外珍视每一个认真生活的小瞬间。
          </p>
          <p>
            本站支持 <strong>Markdown</strong> 与 <strong>LaTeX</strong> 数学公式写作，
            可以在写作页直接编写，也可以导入 <code>.md</code> / <code>.tex</code> 文件。
          </p>

          <h2>主题灵感</h2>
          <p>
            网站配色灵感来自凉风凉：天空蓝的开衫、蜜金渐变珊瑚粉的长发、
            清透青蓝的眼睛，以及清新而温暖的校园风。
          </p>

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

