import { useProfile } from '../context/ProfileContext';

export default function ProfileCard() {
  const { profile } = useProfile();

  return (
    <div className="profile-card">
      <div className="profile-avatar">
        {profile.avatar ? (
          <img src={profile.avatar} alt="头像" />
        ) : (
          <span className="avatar-placeholder" />
        )}
      </div>
      <h3 className="profile-name">{profile.nickname}</h3>
      <p className="profile-signature">{profile.signature}</p>
      <p className="profile-intro">{profile.intro}</p>
    </div>
  );
}
