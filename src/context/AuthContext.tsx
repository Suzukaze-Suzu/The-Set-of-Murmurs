import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

// 管理员（博主）的用户 UUID —— 拥有编辑权限
export const ADMIN_UUID = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null; session: boolean }>;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化时读取当前会话
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 监听登录状态变化
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const isAdmin = !!user && user.id === ADMIN_UUID;

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // 若后台已关闭邮箱确认，signUp 会直接创建会话（session 非空），即注册即登录。
    return { error: error ? error.message : null, session: !!data?.session };
  };

  const signIn = async (email: string, password: string, remember = true) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // 若登录失败（如邮箱未确认）：清除可能残留的旧会话，避免界面继续显示博主身份
    if (error) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    if (!error && !remember) {
      // 未勾选"记住我"：登录后清除本地持久 token，本次会话仍有效，刷新后需重新登录
      try {
        const storageKey = (supabase.auth as any).storageKey || 'supabase.auth.token';
        localStorage.removeItem(storageKey);
      } catch { /* ignore */ }
    }
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
