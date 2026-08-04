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

const ProfileContext = createContext<{
  profile: Profile;
  setProfile: (p: Profile) => void;
} | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [loaded, setLoaded] = useState(false);

  // 从 Supabase 加载公开资料（只有一份，属于 admin 博主）
  useEffect(() => {
    let mounted = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', ADMIN_UUID)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          setProfileState({
            nickname: data.nickname || defaultProfile.nickname,
            avatar: data.avatar || '',
            signature: data.signature || defaultProfile.signature,
            intro: data.intro || defaultProfile.intro,
          });
        } else if (!loaded) {
          // 首次加载，若没有 admin 资料则保留默认
          setProfileState(defaultProfile);
        }
        setLoaded(true);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setProfile = (p: Profile) => {
    setProfileState(p);
    // 只有 admin 才能写入资料到云端
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

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
