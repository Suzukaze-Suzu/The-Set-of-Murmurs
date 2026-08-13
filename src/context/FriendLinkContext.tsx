import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { FriendLink } from '../types';
import { supabase } from '../lib/supabase';

function mkId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface Ctx {
  friends: FriendLink[];
  loading: boolean;
  addFriend: (data: { name: string; url: string; desc?: string; avatar?: string }) => Promise<boolean>;
  updateFriend: (id: string, data: { name: string; url: string; desc?: string; avatar?: string; order?: number }) => Promise<boolean>;
  deleteFriend: (id: string) => Promise<boolean>;
  refresh: () => void;
}

const FriendLinkContext = createContext<Ctx | null>(null);

export function FriendLinkProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from('friend_links')
      .select('*')
      .order('order', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) {
          setFriends(data.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url,
            desc: r.desc || '',
            avatar: r.avatar || '',
            order: typeof r.order === 'number' ? r.order : 0,
          })));
        } else {
          setFriends([]);
        }
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [version]);

  const ensureUrl = (u: string) => {
    const t = u.trim();
    if (!t) return '';
    return /^https?:\/\//i.test(t) ? t : 'https://' + t;
  };

  const addFriend: Ctx['addFriend'] = async (data) => {
    const name = data.name.trim();
    const url = ensureUrl(data.url);
    if (!name || !url) return false;
    const nextOrder = friends.length ? Math.max(...friends.map((f) => f.order)) + 1 : 0;
    const row: Record<string, unknown> = {
      id: 'fl_' + mkId(),
      name,
      url,
      order: nextOrder,
    };
    if (data.desc && data.desc.trim()) row.desc = data.desc.trim();
    if (data.avatar && data.avatar.trim()) row.avatar = data.avatar.trim();
    const { error } = await supabase.from('friend_links').insert(row);
    if (error) { console.error('添加友链失败：', error.message); return false; }
    refresh();
    return true;
  };

  const updateFriend: Ctx['updateFriend'] = async (id, data) => {
    const patch: Record<string, unknown> = {};
    if (typeof data.name === 'string') patch.name = data.name.trim();
    if (typeof data.url === 'string') patch.url = ensureUrl(data.url);
    if (typeof data.desc === 'string') patch.desc = data.desc.trim();
    if (typeof data.avatar === 'string') patch.avatar = data.avatar.trim();
    if (typeof data.order === 'number') patch.order = data.order;
    if (!Object.keys(patch).length) return false;
    const { error } = await supabase.from('friend_links').update(patch).eq('id', id);
    if (error) { console.error('更新友链失败：', error.message); return false; }
    refresh();
    return true;
  };

  const deleteFriend: Ctx['deleteFriend'] = async (id) => {
    if (!window.confirm('确定要删除这个友链吗？')) return false;
    const { error } = await supabase.from('friend_links').delete().eq('id', id);
    if (error) { console.error('删除友链失败：', error.message); return false; }
    refresh();
    return true;
  };

  return (
    <FriendLinkContext.Provider value={{ friends, loading, addFriend, updateFriend, deleteFriend, refresh }}>
      {children}
    </FriendLinkContext.Provider>
  );
}

export function useFriendLinks() {
  const ctx = useContext(FriendLinkContext);
  if (!ctx) throw new Error('useFriendLinks must be used within FriendLinkProvider');
  return ctx;
}