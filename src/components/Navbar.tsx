import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CATEGORIES, CATEGORY_META } from '../types';
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
  const [hidden, setHidden] = useState(false); // 向下滚动隐藏
  const [scrolled, setScrolled] = useState(false); // 滚出顶部后加深阴影
  const [menuOpen, setMenuOpen] = useState(false); // 移动端侧边栏

  // 向下滚动隐藏导航，向上滚动显示
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

  // 滚出顶部后加深阴影（视觉层次）
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 路由切换时自动关闭侧边栏
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // 侧边栏打开时锁定背景滚动（恢复原值，避免覆盖阅读器等的滚动控制）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? 'hidden' : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const linkClass = (path: string) => (location.pathname === path ? 'active' : '');

  return (
    <>
      <nav className={`navbar${hidden ? ' nav-hidden' : ''}${scrolled ? ' navbar-scrolled' : ''}`}>
        <div className="nav-inner">
          <button
            className={`nav-burger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="打开菜单"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
          <Link to="/" className="nav-brand">
            <span className="brand-dot" />
            呓语集
          </Link>

          <div className="nav-links">
            <Link to="/" className={linkClass('/')}>首页</Link>
            <Link to="/articles" className={linkClass('/articles')}>全部文章</Link>
            <Link to="/novels" className={linkClass('/novels')}>小说书架</Link>
            <Link to="/gallery" className={linkClass('/gallery')}>图集</Link>
            <Link to="/guestbook" className={linkClass('/guestbook')}>留言板</Link>
            <Link to="/friends" className={linkClass('/friends')}>友链</Link>
            <Link to="/about" className={linkClass('/about')}>关于</Link>
            {isAdmin && (
              <Link to="/write" className={location.pathname.startsWith('/write') ? 'active' : ''}>写作</Link>
            )}
          </div>

          <div className="nav-cats">
            {CATEGORIES.map((c) => (
              <Link key={c} to={CATEGORY_ROUTES[c]} className={linkClass(CATEGORY_ROUTES[c])}>
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

      {/* 移动端侧边栏：遮罩 + 右滑抽屉 */}
      <div className={`nav-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        <aside className={`nav-drawer${menuOpen ? ' open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="nav-drawer-head">
            <span className="brand-dot" />
            菜单
            <button className="nav-drawer-close" onClick={() => setMenuOpen(false)} aria-label="关闭菜单">✕</button>
          </div>
          <div className="nav-drawer-links">
            <Link to="/" className={linkClass('/')}>首页</Link>
            <Link to="/articles" className={linkClass('/articles')}>全部文章</Link>
            <Link to="/novels" className={linkClass('/novels')}>小说书架</Link>
            <Link to="/gallery" className={linkClass('/gallery')}>图集</Link>
            <Link to="/guestbook" className={linkClass('/guestbook')}>留言板</Link>
            <Link to="/friends" className={linkClass('/friends')}>友链</Link>
            <Link to="/about" className={linkClass('/about')}>关于</Link>
            {isAdmin && (
              <Link to="/write" className={location.pathname.startsWith('/write') ? 'active' : ''}>写作</Link>
            )}

            <div className="nav-drawer-divider">分类浏览</div>
            {CATEGORIES.map((c) => (
              <Link key={c} to={CATEGORY_ROUTES[c]} className={linkClass(CATEGORY_ROUTES[c])}>
                <span className="cat-dot" style={{ background: CATEGORY_META[c].color }} />
                {CATEGORY_META[c].label}
              </Link>
            ))}

            {!user && (
              <div className="nav-drawer-auth">
                <Link to="/login" className="btn btn-primary btn-sm">登录</Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
