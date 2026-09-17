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

          {/* ★ 开往-友链接力入口（2026-09-17）★
             依据＝https://www.travellings.cn/docs/join.html《加入开往》原文：
             「您的网站须将开往的外链 https://www.travellings.cn/go.html 放置在一个打开您的网站
               就能看到的地方，例如顶栏、侧栏。对于移动端设备，您仅需要让访客找得到开往外链即可。」
             所以放在 .topbar 这一行（首屏可见；.navbar 滚下去会收起来，这一行不会），
             手机端 ≤640px 整行保留，只是把内边距和字号收小（见 index.css 的 .tj-link 段）。

             图标＝自绘「列车正面」（24 视框 / stroke=currentColor / 2px 圆角线，
             与站内放大的放大镜、主题切换图标同规格，所以跟着主题自动变色，不用维护两套图）。
             文档原文「如需使用图标或 Emoji，推荐使用与火车地铁相关的图标，其次可选火箭飞船图标」，
             并特别注明「我们不再推荐纸飞机图标，易与 Telegram 混淆」，故未用飞机。 */}
          <a
            className="tj-link"
            href="https://www.travellings.cn/go.html"
            target="_blank"
            rel="noopener noreferrer"
            title="开往-友链接力"
            aria-label="开往-友链接力"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="2.2" width="14" height="14.6" rx="3.2" />
              <path d="M8.4 6.6h7.2" />
              <circle cx="9.2" cy="12" r="1.05" />
              <circle cx="14.8" cy="12" r="1.05" />
              <path d="M8.6 16.8 7.2 21M15.4 16.8 16.8 21" />
              <path d="M3.6 21h16.8" />
            </svg>
            开往
          </a>
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

          {/* 开往官方徽标（页脚）★ 2026-09-17
             用的是文档里给的现成素材，原样未改：b.png＝深色字（配浅底）、w.png＝浅色字（配深底），
             两版都渲染、靠 CSS 按 data-theme 切一个显示，这样切换主题时不用重挂 <img>。
             原图 160×40，这里按文档示例的 width="120" 显示。
             已自托管到 /travellings/（没走 travellings.cn 直链）——站点的手机端访问本来就不稳，
             少一次第三方请求少一个变量；文档也允许换成 jsdelivr 镜像，但自托管最稳。 */}
          <p className="footer-travelling">
            <a
              href="https://www.travellings.cn/go.html"
              target="_blank"
              rel="noopener noreferrer"
              title="开往-友链接力"
            >
              <img src="/travellings/b.png" alt="开往-友链接力" className="tj-badge tj-badge-light" width={120} height={30} />
              <img src="/travellings/w.png" alt="" aria-hidden="true" className="tj-badge tj-badge-dark" width={120} height={30} />
            </a>
          </p>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}
