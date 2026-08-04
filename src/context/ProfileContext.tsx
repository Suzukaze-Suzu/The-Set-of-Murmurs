import { createContext, useContext, ReactNode } from 'react';
import { Profile } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

const profileKey = 'yiyuji_profile';

export const defaultProfile: Profile = {
  nickname: '呓语集主人',
  avatar: '', // 留空，支持上传
  signature: '外冷内热，认真记录每个小瞬间',
  intro: '这里是呓语集，记录动漫、随笔、读后感与数学学习。像凉风凉一样，嘴上说着敷衍，心里却格外珍视每一个认真生活的瞬间。',
};

const ProfileContext = createContext<{
  profile: Profile;
  setProfile: (p: Profile) => void;
} | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useLocalStorage<Profile>(profileKey, defaultProfile);
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
