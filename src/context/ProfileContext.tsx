import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth, ADMIN_UUID } from './AuthContext';

export const defaultProfile: Profile = {
  nickname: '呓语集主人',
  avatar: '',
  signature: '外冷内热，认真记录每个小瞬间',
  intro: '这里是呓语集，记录动漫、随笔、读后感与数学学习。像凉风凉一样，嘴上说着敷衍，心里却格外珍视每一个认真生活的瞬间。',
};

export const defaultUserProfile: Profile = {
  nickname: '',
  avatar: '',
  signature: '',
  intro: '',
};

const ProfileContext = createContext<{
  // 博主（呓语集主人/网站主人）的公开资料——用于首页、关于展示
  profile: Profile;
  setProfile: (p: Profile) => void;
  // 当前登录用户自己的资料（可编辑自己的）
  myProfile: Profile | null;
  setMyProfile: (p: Profile) => void;
  refreshMyProfile: () => void;
} | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isAdmin, user } = useAuth();
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [myProfile, setMyProfileState] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const userId = user?.id ?? null;

  // 加载博主（呓语集主人）公开资料
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ADMIN_UUID)
        .maybeSingle();
      if (!mounted) return;
      if (data) {
        setProfileState({
          nickname: data.nickname || defaultProfile.nickname,
          avatar: data.avatar || '',
          signature: data.signature || defaultProfile.signature,
          intro: data.intro || defaultProfile.intro,
        });
      } else if (!loaded) {
        setProfileState(defaultProfile);
      }
      setLoaded(true);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载当前登录用户自己的资料
  const loadMyProfile = async () => {
    if (!userId) { setMyProfileState(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      setMyProfileState({
        nickname: data.nickname || '',
        avatar: data.avatar || '',
        signature: data.signature || '',
        intro: data.intro || '',
      });
    } else {
      // 还没有资料就创建一个空的（方便编辑）
      setMyProfileState(defaultUserProfile);
    }
  };

  useEffect(() => {
    loadMyProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refreshMyProfile = () => { loadMyProfile(); };

  // 只有博主能写"博主资料"
  const setProfile = (p: Profile) => {
    setProfileState(p);
    if (isAdmin) {
      supabase
        .from('profiles')
        .upsert(
          { id: ADMIN_UUID, nickname: p.nickname, avatar: p.avatar, signature: p.signature, intro: p.intro },
          { onConflict: 'id' }
        )
        .then(() => {});
    }
  };

  // 当前登录用户写自己的资料
  const setMyProfile = (p: Profile) => {
    if (!userId) return;
    setMyProfileState(p);
    supabase
      .from('profiles')
      .upsert(
        { id: userId, nickname: p.nickname, avatar: p.avatar, signature: p.signature, intro: p.intro },
        { onConflict: 'id' }
      )
      .then(() => {});
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile, myProfile, setMyProfile, refreshMyProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
