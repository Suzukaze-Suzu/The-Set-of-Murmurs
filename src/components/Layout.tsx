import { useState, useEffect } from 'react';
import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface OutletCtx {
  query: string;
}

export default function Layout() {
  const { theme, toggle } = useTheme();
  const { isAdmin } = useAuth();
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
          <p>呓语集 · 像凉风凉一样认真记录每个小瞬间</p>
          <p className="footer-links">
            <a href="#/about">关于</a> · <a href="#/guestbook">留言板</a>{isAdmin && <> · <a href="#/write">写作</a></>}
          </p>
          <p className="footer-copy">Powered by React + Vite · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
