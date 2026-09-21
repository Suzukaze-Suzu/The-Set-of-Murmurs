import { useState, ChangeEvent, useRef, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AvatarCropModal from '../components/AvatarCropModal';
import { Profile } from '../types';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

export default function ProfilePage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get('userId') || null;

  const { myProfile, setMyProfile } = useProfile();
  const { user } = useAuth();

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

  return (
    <div className="page profile-page">
      <h1 className="page-title">{title}</h1>

      {!isSelf && viewLoading && (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <span className="empty-icon empty-icon-ghost" />
          <p>{t('profile.loading')}</p>
        </div>
      )}

      {((isSelf && user) || (!isSelf && !viewLoading)) && (
      <div className="profile-card" style={{ alignSelf: 'auto', textAlign: 'center' }}>
        <div className="profile-avatar">
          {display?.avatar ? <img src={display.avatar} alt={t('profile.avatar')} /> : <span className="avatar-placeholder">👤</span>}
        </div>
        <h2 className="profile-name">{display?.nickname || t('profile.unnamed')}</h2>
        <p className="profile-signature">{display?.signature || t('profile.noSignature')}</p>
        <p className="profile-intro" style={{ whiteSpace: 'pre-wrap' }}>{display?.intro || t('profile.noIntro')}</p>
        {isSelf && user ? (
          <div className="form-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
            {!editMode ? (
              <button className="btn btn-primary" onClick={enterEdit}>{t('profile.editBtn')}</button>
            ) : (
              <button className="btn" onClick={() => setEditMode(false)}>{t('profile.cancel')}</button>
            )}
          </div>
        ) : !isSelf && (
          <div className="form-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="btn" onClick={() => navigate('/')}>{t('profile.backHome')}</button>
          </div>
        )}
      </div>
      )}

      {isSelf && user && editMode && (
        <form className="edit-profile card" onSubmit={saveProfile}>
          <h3>{t('profile.editHeading')}</h3>
          <button type="button" className="avatar-upload-btn" onClick={() => avatarInput.current?.click()}>
            {display?.avatar ? <img src={display.avatar} alt={t('profile.avatar')} /> : <span className="avatar-upload-hint">＋<small>{t('profile.avatar')}</small></span>}
          </button>
          <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
          <label>{t('profile.nickname')}</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <label>{t('profile.signature')}</label>
          <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} />
          <label>{t('profile.introLabel')}</label>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={4} />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">{t('profile.save')}</button>
            <button type="button" className="btn" onClick={() => setEditMode(false)}>{t('profile.cancel')}</button>
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
