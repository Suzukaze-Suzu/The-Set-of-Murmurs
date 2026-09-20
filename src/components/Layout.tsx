import { useState, useEffect } from 'react';
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
  // 主题切换按钮已搬进顶栏（Navbar），这里只保留「把 theme 写到 <html data-theme> 上」这一件事
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
  const { footer } = useFooter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="layout">
      {/* 顶栏 v2（2026-09-20）：两行合并成一行——原来顶栏下面还有单独一行 .topbar
          （全文搜索框 + 「切换暗色」按钮 + 「开往」入口），现在：
            · 搜索收成顶栏右侧的放大镜图标（点开是从顶栏下方展开的浮层，不占顶栏宽度）；
            · 主题切换收成顶栏里的图标按钮；
            · 「开往」入口搬进顶栏 nav-actions（用户要求它必须留在顶栏、不进抽屉）。
          搜索词 query 仍由这里持有：通过 props 传给顶栏，通过 Outlet context 传给页面。 */}
      <Navbar query={query} setQuery={setQuery} />

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
             少一次第三方请求少一个变量；文档也允许换成 jsdelivr 镜像，但自托管最稳。
             注：顶栏那个「开往」图标入口在 Navbar.tsx 的 nav-actions 里，**不用新 CSS**——
             它复用既有的 .nav-icon-btn（36×36 圆角图标按钮），和旁边的放大镜、主题切换同一套样式。 */}
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
