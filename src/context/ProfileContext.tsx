import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth, ADMIN_UUID } from './AuthContext';
import { initialProfile, rememberProfile } from '../lib/siteCache';

// 兜底资料：只在「线上确实还没有这条资料行」时才用（正常情况见 src/lib/siteCache.ts）。
// 值＝2026-09-17 线上实际在用的文案。以前这里留着更早的一套旧文案，慢网/请求失败时
// 会被当成首屏内容显示出来（用户看到的「之前的默认文字」就是这个），已改掉。
export const defaultProfile: Profile = {
  nickname: '凉风凉',
  avatar: '',
  signature: '未知的梦话与胡言乱语',
  intro: '这里是呓语集，会记录一些不自知的情绪和严谨的呓语',
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
  // 首屏直接用「本机缓存 > 构建时快照」里的线上文案，不再先渲染兜底值（见 siteCache.ts）
  const [profile, setProfileState] = useState<Profile>(() => initialProfile());
  const [myProfile, setMyProfileState] = useState<Profile | null>(null);

  const userId = user?.id ?? null;

  // 加载博主（呓语集主人）公开资料
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ADMIN_UUID)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        // 读失败（手机上直连 Supabase 失败是常态）：保留首屏已经填好的线上文案，
        // 绝不退回兜底值——否则页面上会出现几个月前写死的旧签名。
        console.warn('[profile] 博主资料读取失败，沿用缓存/快照文案：', error.message);
        return;
      }
      if (data) {
        const next: Profile = {
          nickname: data.nickname || defaultProfile.nickname,
          avatar: data.avatar || '',
          signature: data.signature || defaultProfile.signature,
          intro: data.intro || defaultProfile.intro,
        };
        setProfileState(next);
        rememberProfile(next);   // 写回本机缓存，下次首屏直接用
      } else {
        // 线上确实没有这条资料，这才是「现在的状态」
        setProfileState(defaultProfile);
      }
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
    rememberProfile(p);   // 站长自己改完资料，本机首屏立刻就是新值
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
