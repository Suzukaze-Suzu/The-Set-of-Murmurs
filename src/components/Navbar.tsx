import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { CATEGORIES, CATEGORY_META } from '../types';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useT, useLocale } from '../i18n';
import type { DictKey } from '../i18n/dict';
import { catKey } from '../i18n/dict';

/* ============================================================
   顶栏 v2 —— 2026-09-20
   v3（未提交的那一版）已作废，留档在 blog/first/hold-nav-v3/。本版按用户逐条拍板的
   布局重做，只动布局，不动配色线 / 字体线 / 分类小签 / 阅读器等别的线。

   三档布局（断点表在 index.css 文件末尾「顶栏断点表（v2）」）：
     ≥1200px     品牌 | 主导航 | 分类彩点条 | 操作区（一行）
                 彩点 = **停留态只有一个点**，鼠标悬停 / 键盘 Tab 聚焦时**这一个点就地变长**成
                 「点 + 分类名」的胶囊（不是浮在下方的小气泡），移开/失焦缩回。
                 宽度账：悬停展开最长项 +70px，由 .nav-links（flex:1）吸收，右侧操作区不位移。
     1024~1199   这一档**不放彩点条**，改成文字按钮「分类 ∨」+ 下拉（5 个分类名，每项前面
                 挂一条自己的颜色小竖条）。原因：保留彩点、悬停展开时整行会超出约 44px。
     ≤1023px     汉堡 | 品牌 | 操作区（搜索图标 / 开往 / 主题切换 / 头像或登录按钮）。
                 主导航与分类都进抽屉；**「开往」留在顶栏，不进抽屉**（用户明确要求）。
                 登录态在顶栏收成**纯头像按钮** + 小菜单（个人主页 / 退出登录）——不收会溢出。
                 ≤480px 去掉「呓语集」文字只留 logo；≤640px 收内边距与品牌字号。

   宽度预算（与 index.css 里同一份注释保持一致）：≥1200 访客 813/1032 余 219；≥1200 管理员
   950/1032 余 82（展开最长项 +70 由导航区吸收，最紧约 12）；1024~1199 管理员（下拉）916/976
   余 60；390 管理员（登录态头像）345/358 余 45；≤480 管理员（只留 logo）295/358 余 95。

   本版**不做**（用户明确）：搜索浮层不点外部关闭、不加 / 或 Ctrl+K 快捷键、不加 aria-current、
   不加阅读进度条、不改滚动隐藏行为、不处理搜索跨页失效。

   ★★ 英文版顶栏（2026-09-21，用户报「英文版网站顶栏冲突」，随后又要求「彩点留着，整体拉宽一点」）★★
   实测根因（无头 Chrome，.nav-inner 原定格 1080 宽、正文宽 1032）：
     中文整行需要 103 + 374.4(导航) + 114(彩点条) + 231.8(操作区) + 3×14 = 865.2 → 余 166.8；
     英文整行需要 135.9 + 545.9(导航) + 114 + 252.4 + 42 = 1090.2 → **超 58.2px**。
   超出的部分既没被裁剪也没换行（.nav-links 是 flex:1、各项 nowrap），所以末项 About 顶出
   自己的盒子、压到分类彩点上——实测重叠 44px，这就是「冲突」的实体。
   英文更挤的原因：7 个导航项中文各 2 个字（每项 49.2），英文是 5~9 个字母
   （Guestbook 91.6 / Bookshelf 86.7 / Articles 72.9…），光导航就多 171.5px。

   最终形态（用户拍板「彩点留着」）：
     ① 英文顶栏**整条拉宽**：.nav-inner 与 .nav-search-inner 的 max-width 1080 → 1160
        （正文宽 1032 → 1112）。拉宽安全：顶栏本来就不跟内容列对齐——.page / .hero / 各
        section 都是 920 宽，1440 视口下顶栏 180~1260、内容列 260~1180；
     ② 英文导航项只收内边距与项间距（11→7 / 5→2），**字号保持 .85rem 不动**；
     ③ 英文分类名比中文长（Impressions 75 / Study Notes 71 / Math Notes 68），中文那档
        悬停展开的 56px 上限会把英文名剪掉 → 英文单独放到 88px；
     ④ 英文页登录态**任何宽度都收成「头像 + 小菜单」**（isNarrow || locale === 'en'）：
        英文的「Author · Sign out」比中文「博主 · 退出登录」宽 21.8px，≥1200 整行放不下。
     以上 ①②③ 全在 index.css 末尾「英文页顶栏宽度账」；本文件只负责 ④ 与下面的 ⑤。
     ⑤ 本文件里剩下的硬编码中文（分类下拉的「分类」按钮、彩点与抽屉里的分类名、几处
        aria-label）全部换成字典键——原来英文站的顶栏会蹦出「分类」「读后感」这类中文。
   实测结果（.tmp-nav-en-verify.mjs，2 语 × 11 个宽度，含**彩点逐个展开的峰值**在内共 22 项断言全绿）：
     中文 865.2/1032（展开峰值余 118.8）、英文 996.1/1112（展开峰值余 39.3）、
     1024 视口英文 982.6/992（这一档按断点表走「Categories ∨」下拉）。
   ============================================================ */

const CATEGORY_ROUTES: Record<string, string> = {
  anime: '/category/anime',
  essay: '/category/essay',
  reading: '/category/reading',
  math: '/category/math',
  study: '/category/study',
};

/* active 判定统一成 startsWith：原来只有 pathname === path 才算激活，
   所以停在 /article/xxx、/category/xxx 这类详情页时「文章」不会高亮。
   ★ 英文版（2026-09-21）：label 换成**字典键**，由 t() 按当前语言取词；
     路由 to 仍是语言无关的（react-router 的 basename 会补上 /en 前缀）。 */
const NAV_ITEMS: { to: string; labelKey: DictKey; match: (path: string) => boolean }[] = [
  { to: '/', labelKey: 'nav.home', match: (p) => p === '/' },
  {
    to: '/articles',
    labelKey: 'nav.articles',
    match: (p) => p.startsWith('/articles') || p.startsWith('/article/') || p.startsWith('/category/'),
  },
  { to: '/novels', labelKey: 'nav.bookshelf', match: (p) => p.startsWith('/novels') },
  { to: '/gallery', labelKey: 'nav.gallery', match: (p) => p.startsWith('/gallery') },
  { to: '/guestbook', labelKey: 'nav.guestbook', match: (p) => p.startsWith('/guestbook') },
  { to: '/friends', labelKey: 'nav.friends', match: (p) => p.startsWith('/friends') },
  { to: '/about', labelKey: 'nav.about', match: (p) => p.startsWith('/about') },
];

/** ≤1023px 这一档要换一套结构（登录态收成纯头像 + 菜单），所以宽度得让 JS 也知道。 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

interface NavbarProps {
  /** 全文搜索词（由 Layout 持有，页面通过 Outlet context 取用） */
  query: string;
  setQuery: (value: string) => void;
}

export default function Navbar({ query, setQuery }: NavbarProps) {
  const location = useLocation();
  const { myProfile } = useProfile();
  const { isAdmin, user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const t = useT();
  const { altHref, locale } = useLocale();
  const isNarrow = useMediaQuery('(max-width:1023px)');

  const [hidden, setHidden] = useState(false); // 向下滚动隐藏
  const [scrolled, setScrolled] = useState(false); // 滚出顶部后加深阴影
  const [menuOpen, setMenuOpen] = useState(false); // ≤1023 抽屉
  const [searchOpen, setSearchOpen] = useState(false); // 搜索浮层
  const [catMenuOpen, setCatMenuOpen] = useState(false); // 1024~1199 分类下拉
  const [userMenuOpen, setUserMenuOpen] = useState(false); // ≤1023 头像菜单
  const searchRef = useRef<HTMLInputElement>(null);
  const catMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  /* 原来这里挂了两个 scroll 监听（一个管隐藏、一个管阴影），现合并成一个，
     并加 20px 滞回阈值——触控板/滚轮微抖不会再让顶栏闪进闪出。 */
  useEffect(() => {
    const HIDE_AT = 80; // 超过这个位置才允许隐藏
    const HYSTERESIS = 20; // 累计位移超过它才判定方向
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (y <= HIDE_AT) {
        setHidden(false);
        lastY = y;
        return;
      }
      const delta = y - lastY;
      if (Math.abs(delta) < HYSTERESIS) return;
      setHidden(delta > 0);
      lastY = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 路由切换时收掉所有浮层
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setCatMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // 抽屉打开时锁定背景滚动（恢复原值，避免覆盖阅读器等的滚动控制）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? 'hidden' : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // 宽度跨过 1023/1024 时把这两档的浮层收掉（结构会换一套）
  useEffect(() => {
    setUserMenuOpen(false);
    setCatMenuOpen(false);
  }, [isNarrow]);

  // 搜索浮层打开后自动聚焦
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Esc 关闭搜索浮层
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  /* 分类下拉：用户要求这个控件自己有「Esc 关闭 + 点外部关闭」 */
  useEffect(() => {
    if (!catMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) setCatMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [catMenuOpen]);

  /* 头像菜单：同上 */
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const isActive = (item: { match: (path: string) => boolean }) => item.match(location.pathname);

  return (
    <>
      <nav className={`navbar${hidden ? ' nav-hidden' : ''}${scrolled ? ' navbar-scrolled' : ''}`}>
        <div className="nav-inner">
          <button
            className={`nav-burger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <Link to="/" className="nav-brand">
            <img src="/logo.svg" alt="" className="brand-logo brand-logo-light" />
            <img src="/logo-dark.svg" alt="" className="brand-logo brand-logo-dark" />
            <span className="brand-text">{t('brand.short')}</span>
          </Link>

          <div className="nav-links">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={isActive(item) ? 'active' : ''}>
                {t(item.labelKey)}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/write" className={location.pathname.startsWith('/write') ? 'active' : ''}>{t('nav.write')}</Link>
            )}
          </div>

          {/* ★ ≥1200px：分类彩点条（停留态只有一个点）★
              悬停 / Tab 聚焦时**这一个点就地变长**成「点 + 分类名」的胶囊（不是浮在下方的小气泡）；
              展开多出来的宽度由 .nav-links（flex:1）吸收，右侧操作区不会被推着跳。
              配色遵守铁律：该分类色的 12% 淡底 + 该分类的同色系墨色字（CATEGORY_META[c].ink）——
              不是「实底 + 白字」，也没引入任何新色号。--c 只用于 background，ink 只用于 color。 */}
          <div className="nav-cats" aria-label={t('nav.browseCategories')}>
            {CATEGORIES.map((c) => {
              const to = CATEGORY_ROUTES[c];
              const meta = CATEGORY_META[c];
              return (
                <Link
                  key={c}
                  to={to}
                  className={`cat-dot-link${location.pathname === to ? ' active' : ''}`}
                  title={t(catKey(c))}
                  aria-label={t(catKey(c))}
                  style={{ '--c': meta.color, color: meta.ink } as CSSProperties}
                >
                  <span className="cat-dot" style={{ background: meta.color }} />
                  <span className="cat-name">{t(catKey(c))}</span>
                </Link>
              );
            })}
          </div>

          {/* ★ 1024~1199px：文字按钮「分类 ∨」+ 下拉 ★
              这一档不放彩点条（保留彩点、悬停展开时整行会超出约 44px），改成文字按钮。
              自带头部要求的 Esc 关闭与点外部关闭。 */}
          <div className={`nav-cat-menu${catMenuOpen ? ' open' : ''}`} ref={catMenuRef}>
            <button
              className={`nav-cat-toggle${catMenuOpen ? ' open' : ''}`}
              onClick={() => setCatMenuOpen((o) => !o)}
              aria-label={t('nav.browseCategories')}
              aria-haspopup="true"
              aria-expanded={catMenuOpen}
            >
              {t('nav.categories')}
              <span className="nav-cat-caret" aria-hidden="true">∨</span>
            </button>
            {catMenuOpen && (
              <div className="nav-cat-panel">
                {CATEGORIES.map((c) => {
                  const to = CATEGORY_ROUTES[c];
                  const meta = CATEGORY_META[c];
                  return (
                    <Link
                      key={c}
                      to={to}
                      className={`nav-cat-item${location.pathname === to ? ' active' : ''}`}
                    >
                      <span className="nav-cat-bar" style={{ background: meta.color }} />
                      {t(catKey(c))}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="nav-actions">
            <button
              className={`nav-icon-btn${searchOpen ? ' active' : ''}`}
              onClick={() => setSearchOpen((o) => !o)}
              aria-label={t('nav.search')}
              aria-expanded={searchOpen}
              title={t('nav.search')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4.3-4.3" />
              </svg>
            </button>

            {/* ★ 开往-友链接力 ◎ 用户明确要求：必须留在顶栏，不许收进抽屉 ★
                依据＝https://www.travellings.cn/docs/join.html《加入开往》：
                「您的网站须将开往的外链 https://www.travellings.cn/go.html 放置在一个打开您的网站
                  就能看到的地方，例如顶栏、侧栏。对于移动端设备，您仅需要让访客找得到开往外链即可。」
                nav-actions 在 ≥1200 / 1024~1199 / ≤1023 三档里都在（抽屉那一档只是 .nav-links 与
                .nav-cats 被收掉，操作区整排保留），所以手机端也在顶栏看得见。
                图标＝自绘「列车正面」SVG：24 视框 / stroke=currentColor / 2px 圆角线，与旁边的放大镜、
                主题切换同规格，亮暗主题自动跟随。文档原文「如需使用图标或 Emoji，推荐使用与火车地铁
                相关的图标，其次可选火箭飞船」，并注明「不再推荐纸飞机图标，易与 Telegram 混淆」，故用列车。 */}
            <a
              className="nav-icon-btn"
              href="https://www.travellings.cn/go.html"
              target="_blank"
              rel="noopener noreferrer"
              title={t('nav.travellingsTitle')}
              aria-label={t('nav.travellings')}
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
            </a>

            <button
              className="nav-icon-btn"
              onClick={toggle}
              aria-label={t('nav.switchTheme')}
              title={t(theme === 'light' ? 'nav.darkMode' : 'nav.lightMode')}
            >
              {theme === 'light' ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.5 13.3A8.2 8.2 0 1 1 10.7 3.5a6.5 6.5 0 0 0 9.8 9.8z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
                </svg>
              )}
            </button>

            {/* ★ 语言切换（英文版 P1，2026-09-21）★
                用 <a> 而不是 <Link>：切语言＝换 URL 前缀，整页重载最干净
                （字典、<html lang>、首屏字体 preload 都要跟着换，SPA 内切会留下旧语言的字形缓存）。
                显示的字是**目标语言**：中文站显示 EN，英文站显示 中文。
                宽度：.nav-icon-btn 是 36×36 的圆角图标按钮，所以标签刻意做成 2 字符。 */}
            <a
              className="nav-icon-btn nav-lang-btn"
              href={altHref()}
              title={t('locale.switchTitle')}
              aria-label={t('locale.switchTitle')}
              lang={t('locale.switch') === 'EN' ? 'en' : 'zh-CN'}
            >
              <span className="nav-lang-text">{t('locale.switch')}</span>
            </a>

            <div className="nav-auth">
              {user ? (
                isNarrow || locale === 'en' ? (
                  /* ≤1023px：登录态收成**纯头像按钮** + 小菜单（不收会溢出，见宽度账）
                     ★ 英文页（2026-09-21）：任何宽度都走这一套——英文的「Author · Sign out」
                     比中文「博主 · 退出登录」宽 21.8px，加上英文导航多出的 171.5px，
                     ≥1200 的管理员整行会超出 75px（实测）。头像版只需 931.5px，放得下。
                     中文站 ≥1024 的行为不变（仍是「博主 · 退出登录」+ 头像）。 */
                  <div className="nav-user" ref={userMenuRef}>
                    <button
                      className={`nav-avatar${location.pathname === '/profile' ? ' active' : ''}`}
                      onClick={() => setUserMenuOpen((o) => !o)}
                      aria-label={t('nav.account')}
                      aria-haspopup="true"
                      aria-expanded={userMenuOpen}
                      title={t(isAdmin ? 'nav.author' : 'nav.account')}
                    >
                      {myProfile?.avatar ? (
                        <img src={myProfile.avatar} alt="" />
                      ) : (
                        <span className="nav-avatar-placeholder" />
                      )}
                    </button>
                    {userMenuOpen && (
                      <div className="nav-user-menu">
                        <Link to="/profile" className="nav-user-item" onClick={() => setUserMenuOpen(false)}>
                          {t('nav.myProfile')}
                        </Link>
                        <button className="nav-user-item danger" onClick={() => signOut()}>
                          {t('nav.signOut')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button className="btn btn-primary btn-sm nav-signout" onClick={() => signOut()} title={t('nav.signOut')}>
                      {t(isAdmin ? 'nav.author' : 'nav.account')} · {t('nav.signOut')}
                    </button>
                    <Link
                      to="/profile"
                      className={`nav-avatar${location.pathname === '/profile' ? ' active' : ''}`}
                      title={t('nav.myProfile')}
                    >
                      {myProfile?.avatar ? (
                        <img src={myProfile.avatar} alt={t('common.avatar')} />
                      ) : (
                        <span className="nav-avatar-placeholder" />
                      )}
                    </Link>
                  </>
                )
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm">{t('nav.signIn')}</Link>
              )}
            </div>
          </div>
        </div>

        {/* 搜索浮层：从顶栏下方展开，因此不占顶栏一行的宽度（原来是单独一整行 .topbar） */}
        {searchOpen && (
          <div className="nav-search">
            <div className="nav-search-inner">
              <div className="nav-search-input">
                <span className="search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder={t('nav.searchPlaceholderEsc')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="search-clear" onClick={() => setQuery('')} aria-label={t('nav.clearSearch')}>×</button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* 移动端侧边栏：遮罩 + 左侧抽屉（≤1023px 时由 CSS 唤出汉堡按钮）
          导航与分类都收在这里；「开往」不在这里——它在顶栏 nav-actions 里 */}
      <div className={`nav-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        <aside className={`nav-drawer${menuOpen ? ' open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="nav-drawer-head">
            <span className="brand-dot" />
            {t('nav.menu')}
            <button className="nav-drawer-close" onClick={() => setMenuOpen(false)} aria-label={t('nav.closeMenu')}>×</button>
          </div>

          {/* 抽屉里补上搜索框：顶栏的搜索图标在窄屏也在，但抽屉里直接输入更顺手 */}
          <div className="nav-drawer-search">
            <input
              type="text"
              placeholder={t('nav.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('nav.searchPlaceholder')}
            />
          </div>

          <div className="nav-drawer-links">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={isActive(item) ? 'active' : ''}>
                {t(item.labelKey)}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/write" className={location.pathname.startsWith('/write') ? 'active' : ''}>{t('nav.write')}</Link>
            )}

            {/* 手机端分类保持现状不动：抽屉里就是「彩点 + 文字」那套 */}
            <div className="nav-drawer-divider">{t('nav.browseCategories')}</div>
            {CATEGORIES.map((c) => (
              <Link key={c} to={CATEGORY_ROUTES[c]} className={location.pathname === CATEGORY_ROUTES[c] ? 'active' : ''}>
                <span className="cat-dot" style={{ background: CATEGORY_META[c].color }} />
                {t(catKey(c))}
              </Link>
            ))}

            {!user && (
              <div className="nav-drawer-auth">
                <Link to="/login" className="btn btn-primary btn-sm">{t('nav.signIn')}</Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
