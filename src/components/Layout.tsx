import { useState, useEffect } from 'react';
import { ReactNode } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';
import BackToTop from './BackToTop';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFooter } from '../context/SiteTextContext';

interface OutletCtx {
  query: string;
}

export default function Layout() {
  const { theme, toggle } = useTheme();
  const { isAdmin } = useAuth();
  const { footer } = useFooter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="layout">
      <Navbar />
      <div className="topbar">
        <div className="topbar-inner">
          <div className="search-box">
            <span className="search-icon" />
            <input
              type="text"
              placeholder="全文搜索文章…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')}>✕</button>
            )}
          </div>
          <button className="theme-toggle" onClick={toggle} title="切换主题">
            {theme === 'light' ? '切换暗色' : '切换亮色'}
          </button>
        </div>
      </div>

      <main className="main">
        <Outlet context={{ query } satisfies OutletCtx} />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <p className="footer-slogan">{footer.slogan}</p>
          {footer.caption && <p className="footer-caption">{footer.caption}</p>}
          <p className="footer-links">
            <Link to="/about">关于</Link> · <Link to="/guestbook">留言板</Link> · <Link to="/friends">友链</Link> · <a href="/rss.xml" target="_blank" rel="noopener">RSS</a>{isAdmin && <> · <Link to="/write">写作</Link></>}
          </p>
          <p className="footer-copy">{footer.copyright.replace('{year}', String(new Date().getFullYear()))}</p>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}
