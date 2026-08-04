import { Link } from 'react-router-dom';
import { CATEGORIES, CATEGORY_META } from '../types';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import AuthButton from './AuthButton';

const CATEGORY_ROUTES: Record<string, string> = {
  anime: '/category/anime',
  essay: '/category/essay',
  reading: '/category/reading',
  math: '/category/math',
  study: '/category/study',
};

export default function Navbar() {
  const location = useLocation();
  const { profile } = useProfile();
  const { isAdmin } = useAuth();
  const [showIntro, setShowIntro] = useState(false);

  return (
    <>
      <nav className="navbar">
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
            <AuthButton />
          </div>
          <button className="nav-avatar" onClick={() => setShowIntro(true)} title="点击查看我的介绍">
            {profile.avatar ? (
              <img src={profile.avatar} alt="头像" />
            ) : (
              <span className="nav-avatar-placeholder" />
            )}
          </button>
        </div>
      </nav>

      {showIntro && (
        <div className="modal-overlay" onClick={() => setShowIntro(false)}>
          <div className="intro-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowIntro(false)}>×</button>
            <div className="intro-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt="头像" />
              ) : (
                <span className="avatar-placeholder" />
              )}
            </div>
            <h2 className="intro-name">{profile.nickname}</h2>
            <p className="intro-signature">{profile.signature}</p>
            <p className="intro-bio">{profile.intro}</p>
            <Link to="/about" className="btn btn-primary btn-sm" onClick={() => setShowIntro(false)}>
              编辑我的资料
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

