import { Link } from 'react-router-dom';
import { CATEGORIES, CATEGORY_META } from '../types';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ROUTES: Record<string, string> = {
  anime: '/category/anime',
  essay: '/category/essay',
  reading: '/category/reading',
  math: '/category/math',
  study: '/category/study',
};

export default function Navbar() {
  const location = useLocation();
  const { myProfile } = useProfile();
  const { isAdmin, user, signOut } = useAuth();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY && y > 80) setHidden(true);
      else if (y < lastY) setHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={hidden ? 'navbar nav-hidden' : 'navbar'}>
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          <span className="brand-dot" />
          呓语集
        </Link>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>首页</Link>
          <Link to="/articles" className={location.pathname === '/articles' ? 'active' : ''}>全部文章</Link>
          <Link to="/gallery" className={location.pathname === '/gallery' ? 'active' : ''}>图集</Link>
          <Link to="/guestbook" className={location.pathname === '/guestbook' ? 'active' : ''}>留言板</Link>
          <Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>关于</Link>
          {isAdmin && (
            <Link to="/write" className={location.pathname.startsWith('/write') ? 'active' : ''}>写作</Link>
          )}
        </div>
        <div className="nav-cats">
          {CATEGORIES.map((c) => (
            <Link key={c} to={CATEGORY_ROUTES[c]} className={location.pathname === CATEGORY_ROUTES[c] ? 'active' : ''}>
              <span className="cat-dot" style={{ background: CATEGORY_META[c].color }} />
              <span className="cat-text">{CATEGORY_META[c].label}</span>
            </Link>
          ))}
        </div>
        <div className="nav-auth">
          {user ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => signOut()} title="退出登录">
                {isAdmin ? '博主' : '账号'} · 退出
              </button>
              <Link
                to="/profile"
                className="nav-avatar"
                title="我的主页"
                style={location.pathname === '/profile' ? { boxShadow: '0 0 0 3px var(--sky-blue)' } : undefined}
              >
                {myProfile?.avatar ? (
                  <img src={myProfile.avatar} alt="头像" />
                ) : (
                  <span className="nav-avatar-placeholder" />
                )}
              </Link>

            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">登录</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
