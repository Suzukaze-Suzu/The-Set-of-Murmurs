import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BackToTop from './BackToTop';
import N1Shell from './n1/N1Shell';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useArticles } from '../context/ArticleContext';
import { useFooter } from '../context/SiteTextContext';
import { useT, useLocale } from '../i18n';
import { mastheadDate, SITE_DOMAIN, LATIN_NAME, ISSUE_FALLBACK } from '../lib/masthead';
import { editionOf } from '../lib/navItems';
import { isN1Route } from '../lib/n1Routes';

interface OutletCtx {
  query: string;
}

export default function Layout() {
  // 主题切换按钮已搬进顶栏（Navbar），这里只保留「把 theme 写到 <html data-theme> 上」这一件事
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
  const { footer } = useFooter();
  const t = useT();
  const { locale } = useLocale();
  const [query, setQuery] = useState('');

  /* ===== B2 报头（2026-10-08）=====
     报头只在**首页**长成这样（巨幅刊名＋日期版次＋拉丁刊名＋副题行），其余页的「报头」
     就是顶栏左侧那枚 23px 小刊名（见 broadsheet.css / Navbar.tsx）。

     ⚠️ 报头**不是 sticky**：它是一块正常流里的内容，往下滚就随页面滚走，
        顶栏（.navbar）自己仍是 sticky —— 报纸的报头本来也不该钉在屏幕上。
     ⚠️ 期号走运行时值（ArticleProvider 的 articles.length，见 lib/masthead.ts 顶部说明），
        所以**发一篇就自动涨一期**，不必等重新构建；数据没回来时退到 ISSUE_FALLBACK。 */
  const { pathname } = useLocation();
  const { profile } = useProfile();
  const { articles, loaded } = useArticles();
  const isHome = pathname === '/';
  const issue = loaded && articles.length > 0 ? articles.length : ISSUE_FALLBACK;
  const edition = editionOf(pathname, isAdmin);
  const dateText = mastheadDate(locale);

  /* 左刊眉（B1 留的 CSS 变量）由这里写值：`呓语集 · 第 12 期 · 第 1 版`。
     值必须是**带引号的 CSS 字符串**（B1 里是 `content: var(--bs-spine-l, "…")`），所以这里补引号。 */
  const spine = [t('brand.short'), t('mast.issue', { n: issue }), edition > 0 ? t('mast.edition', { n: edition }) : '']
    .filter(Boolean).join(' · ');
  const spineVar = { '--bs-spine-l': `"${spine}"` } as CSSProperties;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* ===== 「N1 样张直接做前端」（2026-10-08）=====
     迁移到样张的路由（首页／书架／图集／留言／写作／关于）整个外壳换成 N1Shell——
     报头、导航、报尾都是样张那一份（样式在 src/styles/n1.css）。
     样张里**没有**的界面继续走下面这套旧外壳，等用户点名再做。
     分支放在所有 hook 之后（hook 顺序不变），旧分支一行没动。 */
  if (isN1Route(pathname)) {
    return (
      <N1Shell>
        <Outlet context={{ query } satisfies OutletCtx} />
      </N1Shell>
    );
  }

  return (
    <div className="layout bs" style={spineVar}>
      {/* 天头鱼尾（B1 整页版框，2026-10-08）：古籍版框的做法，吊在内框线正中。
          用真元素是因为 `.layout.bs` 的两个伪元素已经被左右竖排刊眉占掉了；
          纯装饰、`aria-hidden`，不参与任何交互与语义。 */}
      <span className="bs-tail" aria-hidden="true" />

      {/* ===== 报头（首页版）=====
          「日期/版次在右上角 → 巨幅刊名＋logo → 拉丁刊名 → 副题行」四件，照 N1 样张
          `design-mockups\g\n1-broadsheet.mjs` 行 47–76。第五件「双线夹导航」就是下面那条
          sticky 顶栏（报头模式下它顶上多加一条 3px 双线，见 broadsheet.css）。
          站名/标语/简介原来长在首页的 .hero 里 —— 现在归报头，hero 只留两个入口按钮（P2 会重做那块）。 */}
      {isHome && (
        <header className="bs-mast">
          <div className="bs-mast-inner">
            <p className="bs-mast-meta">
              <span className="bs-mast-date">{dateText}</span>
              <span className="bs-mast-sep" aria-hidden="true">·</span>
              <span>{t('mast.issue', { n: issue })}</span>
              {edition > 0 && (
                <>
                  <span className="bs-mast-sep" aria-hidden="true">·</span>
                  <span>{t('mast.edition', { n: edition })}</span>
                </>
              )}
              <span className="bs-mast-sep bs-mast-site" aria-hidden="true">·</span>
              <span className="bs-mast-site">{SITE_DOMAIN}</span>
            </p>

            <h1 className="bs-nameplate">
              <Link to="/" className="bs-np-link">
                <img src="/logo.svg" alt="" className="bs-np-mark bs-np-mark-light" />
                <img src="/logo-dark.svg" alt="" className="bs-np-mark bs-np-mark-dark" />
                <span className="bs-np-zh">{t('brand.short')}</span>
              </Link>
            </h1>

            <p className="bs-npmotto" aria-hidden="true">{LATIN_NAME}</p>

            <p className="bs-npdeck">
              <b>{locale === 'en' ? t('brand.tagline') : (profile.signature || t('brand.tagline'))}</b>
              <span className="bs-npdeck-lede">{locale === 'en' ? t('brand.intro') : (profile.intro || t('brand.intro'))}</span>
            </p>
          </div>
        </header>
      )}

      {/* 顶栏 v2（2026-09-20）：两行合并成一行——原来顶栏下面还有单独一行 .topbar
          （全文搜索框 + 「切换暗色」按钮 + 「开往」入口），现在：
            · 搜索收成顶栏右侧的放大镜图标（点开是从顶栏下方展开的浮层，不占顶栏宽度）；
            · 主题切换收成顶栏里的图标按钮；
            · 「开往」入口搬进顶栏 nav-actions（用户要求它必须留在顶栏、不进抽屉）。
          搜索词 query 仍由这里持有：通过 props 传给顶栏，通过 Outlet context 传给页面。
          ★ B2：首页传 masthead —— 报头已经有巨幅刊名，顶栏那份小刊名不再重复显示；
            顶栏的**结构、彩点条、操作区一个字没动**（只藏了品牌块，它右侧的三块不位移）。 */}
      <Navbar query={query} setQuery={setQuery} masthead={isHome} />

      <main className="main">
        <Outlet context={{ query } satisfies OutletCtx} />
      </main>

      {/* ===== B3 报尾（2026-10-08）= 报纸的报尾线，照 N1 样张 `common.mjs` 行 108–118：
              「双线夹（上 3px 双线 ／ 下 4px 实线）｜呓语集符号 ＋ 刊名 ＋ 标语 ｜ 友链 · 开往 ＋ 开往徽章」
              ＋ 线外一行版权小注。版式落在新层 broadsheet.css 的 B3 段（`.footer` 基础上覆盖）。
              ⚠️ 这里**只重排，不删文案也不删控件**：标语、副标题、关于/留言板/友链/RSS（＋管理员「写作」）、
                 版权行、开往徽章**一个都没少**，全部改由这一行的版式承载。
              ⚠️ 开往徽章与 logo 都是既有素材，**原样未改**。 */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="foot-mark" aria-hidden="true">
            {/* 站点符号（`public/logo.svg`）：与刊名同款素材，暗色换 logo-dark.svg */}
            <img src="/logo.svg" alt="" className="foot-mark-light" width={24} height={24} />
            <img src="/logo-dark.svg" alt="" className="foot-mark-dark" width={24} height={24} />
          </span>
          <span className="foot-name">{t('brand.short')}</span>
          {/* ★ 英文版（2026-09-21）：页脚标语在英文页用字典里的定稿英文
                 （The Set of Murmurs），中文页**继续用站长在关于页
                 可编辑的线上文案**（Supabase site_texts），中文线的行为一字未改。 */}
          <span className="foot-slogan">{locale === 'en' ? t('brand.full') : footer.slogan}</span>
          {/* 版式上左组与右组之间那一大段弹性空白（N1 的 `.sp`）由 CSS 的
              `.footer-links{margin-left:auto}` 给，不必多挂一个空 span。 */}

          {/* ⚠️ 链接之间的「·」包成 `<span class="fl-sep">`：原来的裸文字节点
              （`<Link/> · <Link/>`）在 flex 里会被当成一个匿名 flex item 占位，
              光靠 `font-size:0` 压不住（实测线上仍量到 3.91px 宽），所以用真元素 + `display:none`
              把它藏掉，分隔改由 `.footer-links a` 的竖细线承担（与顶栏导航同一套语言）。
              `.footer-links` 仍是 `<p>`（phrasing content），故 span 而非 div。 */}
          <p className="footer-links">
            <Link to="/about">{t('nav.about')}</Link><span className="fl-sep" aria-hidden="true"> · </span>
            <Link to="/guestbook">{t('nav.footerGuestbook')}</Link><span className="fl-sep" aria-hidden="true"> · </span>
            <Link to="/friends">{t('nav.footerLinks')}</Link><span className="fl-sep" aria-hidden="true"> · </span>
            <a href="/rss.xml" target="_blank" rel="noopener">RSS</a>{isAdmin && <><span className="fl-sep" aria-hidden="true"> · </span><Link to="/write">{t('nav.write')}</Link></>}
          </p>

          {/* 副标题（站长可编辑的线上文案）与「友链 · 开往」标签排在徽章这一侧，
              这样 N1 那一行「左＝符号＋刊名＋标语 ／ 右＝友链 · 开往 ＋ 徽章」的骨架不变。 */}
          {(locale === 'en' ? t('brand.footerCaption') : footer.caption) && (
            <span className="foot-caption">
              {locale === 'en' ? t('brand.footerCaption') : footer.caption}
            </span>
          )}
          <span className="foot-flabel">{t('foot.travellingsLabel')}</span>

          {/* 开往官方徽标（页脚）★ 2026-09-17，B3 起按 N1 加一层细线白底框（`.tww`）
             用的是文档里给的现成素材，原样未改：b.png＝深色字（配浅底）、w.png＝浅色字（配深底），
             两版都渲染、靠 CSS 按 data-theme 切一个显示，这样切换主题时不用重挂 <img>。
             原图 160×40，这里按文档示例的 width="120" 显示。
             已自托管到 /travellings/（没走 travellings.cn 直链）——站点的手机端访问本来就不稳，
             少一次第三方请求少一个变量；文档也允许换成 jsdelivr 镜像，但自托管最稳。
             注：顶栏那个「开往」图标入口在 Navbar.tsx 的 nav-actions 里，**不用新 CSS**——
             它复用既有的 .nav-icon-btn（36×36 圆角图标按钮），和旁边的放大镜、主题切换同一套样式。 */}
          <span className="foot-tww">
            <a
              href="https://www.travellings.cn/go.html"
              target="_blank"
              rel="noopener noreferrer"
              title={t('nav.travellingsTitle')}
            >
              <img src="/travellings/b.png" alt={t('nav.travellings')} className="tj-badge tj-badge-light" width={120} height={30} />
              <img src="/travellings/w.png" alt="" aria-hidden="true" className="tj-badge tj-badge-dark" width={120} height={30} />
            </a>
          </span>
        </div>
        <p className="foot-copy">{footer.copyright.replace('{year}', String(new Date().getFullYear()))}</p>
      </footer>
      <BackToTop />
    </div>
  );
}
