import { useProfile } from '../context/ProfileContext';
import { useT } from '../i18n';

export default function ProfileCard() {
  const { profile } = useProfile();
  const t = useT();

  return (
    <div className="profile-card">
      <div className="profile-avatar">
        {profile.avatar ? (
          <img src={profile.avatar} alt="头像" loading="lazy" />
        ) : (
          /* 没设头像＝昵称首字（2026-10-08 用户点名；原来是空 span） */
          <span className="avatar-placeholder">
            {(profile.nickname || '').trim().charAt(0) || t('comment.avatarFallback')}
          </span>
        )}
      </div>
      <h3 className="profile-name">{profile.nickname}</h3>
      <p className="profile-signature">{profile.signature}</p>
      <p className="profile-intro">{profile.intro}</p>
    </div>
  );
}
