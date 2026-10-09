import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useArticles } from '../../context/ArticleContext';
import { useFooter } from '../../context/SiteTextContext';
import { useT, useLocale, formatDate } from '../../i18n';
import { mastheadDate, SITE_DOMAIN, LATIN_NAME, ISSUE_FALLBACK } from '../../lib/masthead';
import { editionOf } from '../../lib/navItems';

/* ══════════════════════════════════════════════════════════════════════════════
   N1 外壳（2026-10-08「样张直接做前端」）
   ──────────────────────────────────────────────────────────────────────────────
   报头／报尾逐行照 `design-mockups\g\n1-broadsheet\index.html`（首页版）与
   `about.html`（内页版）写，**类名一个不改**：.wrap / .nav(.nav-mast/.nav-inner) /
   .navmeta / .nameplate / .np-link / .mark / .np-zh / .npmotto / .npdeck / .npslogan /
   .navlinks / .dm / .foot。
   样式在同目录生成出来的 `src/styles/n1.css` 里（由样张 415 行 CSS 机械改写而成）。

   与样张的**唯一差异**（都是「静态样张写死、真站点必须现算」的那几处，写进 CSS 变量）：
     --n1-spine  竖排左刊眉「呓语集 · 第 12 期 · 第 1 版」→ 期＝文章总数、版＝本页在导航里的序号
     --n1-meta   内页天头那行日期（样张里没用到，留着以防备用）
     --n1-byline 首页署名条「文 / 凉风凉 · 图 / 呓语集 · 日期」
     --n1-face   报眼方框下那行「主编 凉风凉」→ 站长昵称
   ══════════════════════════════════════════════════════════════════════════════ */

/* 导航顺序照样张（首页 · 文章 · 书架 · 图集 · 写作 · 留言 · 关于）——
   与站内 NAV_ITEMS 的次序不同（站内把「友链」排在「关于」前），这里以样张为准。

   ★ 2026-10-09 用户原话「让非博主身份的用户隐藏写作按钮」★
   样张是一张静态图，它把「写作」画在导航里是不分登录的；真站点不照做这一条：
   `/write` 只对博主开放（`Write.tsx` 里非博主打开会显示「无权访问写作页」），
   所以入口本身也不该出现——否则访客点进去只能吃一页拒绝文案。
   做法＝给这条打 `adminOnly` 标记，渲染时按 `isAdmin` 过滤（旧 Navbar／旧页脚／
   分类页那三处「写作」入口本来就已经套着 `isAdmin`，全站口径就此统一）。
   博主登录后这一条照常在位次第 5 位，与样张的次序一致。
   回退＝把渲染处的 `.filter(...)` 去掉即可（标记留着不影响）。 */
const N1_NAV: { to: string; key: 'nav.home' | 'nav.articles' | 'nav.bookshelf' | 'nav.gallery' | 'nav.write' | 'nav.guestbook' | 'nav.about'; match: (p: string) => boolean; adminOnly?: boolean }[] = [
  { to: '/', key: 'nav.home', match: (p) => p === '/' },
  { to: '/articles', key: 'nav.articles', match: (p) => p.startsWith('/articles') || p.startsWith('/article/') || p.startsWith('/category/') },
  { to: '/novels', key: 'nav.bookshelf', match: (p) => p.startsWith('/novels') },
  { to: '/gallery', key: 'nav.gallery', match: (p) => p.startsWith('/gallery') },
  { to: '/write', key: 'nav.write', match: (p) => p.startsWith('/write'), adminOnly: true },
  { to: '/guestbook', key: 'nav.guestbook', match: (p) => p.startsWith('/guestbook') },
  { to: '/about', key: 'nav.about', match: (p) => p.startsWith('/about') },
];

export default function N1Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const { isAdmin, user, signOut } = useAuth();
  const { profile } = useProfile();
  const { articles, loaded } = useArticles();
  const { footer } = useFooter();
  const t = useT();
  const { locale, altHref } = useLocale();

  const isHome = pathname === '/';
  const issue = loaded && articles.length > 0 ? articles.length : ISSUE_FALLBACK;
  const edition = editionOf(pathname, isAdmin);
  const dateText = mastheadDate(locale);

  /* 竖排左刊眉＝「呓语集 · 第 12 期 · 第 1 版」（样张那一行，值改由这里现算）。
     值必须是**带引号的 CSS 字符串**（n1.css 里是 content: var(--n1-spine, "…")）。 */
  const spine = [t('brand.short'), t('mast.issue', { n: issue }), edition > 0 ? t('mast.edition', { n: edition }) : '']
    .filter(Boolean)
    .join(' · ');
  /* 署名条（样张「文 / 凉风凉　·　图 / 呓语集　·　2026.9.20」）：末段是样张那天的日期，这里用今天。
     ★ 2026-10-09 用户报「关于页的下方有一个日期在英文下没有变化」★
     病根＝这一段的日期是**手工拼死的点分写法**（`2026.10.9`），中英两站逐字相同 ——
     关于页/首页报眼提要下面那一行，切到英文后只有「文/图」那两段变了，日期没动。
     修法＝中文页照旧（样张原样就是点分 `2026.9.20`，一个字不改），
     英文页改走**全站英文日期的唯一口径** `formatDate`（`9 Oct. 2026`，与文章页署名、
     留言时间戳同一支，含 Sept 的四字母特例），不另造格式。 */
  const today = new Date();
  const shortDate = locale === 'en'
    ? formatDate(today, 'en')
    : `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
  const byline = `${t('home.byline')}　·　${shortDate}`;

  const vars = {
    '--n1-spine': `"${spine}"`,
    '--n1-meta': `"${[dateText, t('mast.issue', { n: issue }), edition > 0 ? t('mast.edition', { n: edition }) : '', SITE_DOMAIN].filter(Boolean).join('　·　')}"`,
    '--n1-byline': `"${byline}"`,
    // 报眼方框下那行：样张是「主编　凉风凉」，昵称取站长资料。
    // ★ 2026-10-09 用户裁决「选择 Suzu Suzukaze」：英文页一律用拉丁署名（与报尾 TEXT / SUZUKAZE 同口径），
    //   中文页仍是资料里的昵称、没填才退到字典兜底（两站都不露对方语言的字）。
    '--n1-face': `"${locale === 'en' ? `Author　${t('brand.author')}` : `主编　${profile.nickname || t('brand.author')}`}"`,
  } as CSSProperties;

  const tagline = locale === 'en' ? t('brand.tagline') : profile.signature || t('brand.tagline');
  const intro = locale === 'en' ? t('brand.intro') : profile.intro || t('brand.intro');
  /* 报尾标语：样张写的是「未知的梦话与胡言乱语」，线上文案里它落在 footer.caption
     （线上 footer.slogan 是「呓语集」，直接用会出现「呓语集 呓语集」——旧页脚就是这样）。 */
  const slogan = locale === 'en' ? t('brand.footerCaption') : footer.caption || t('brand.tagline');

  /* 站点符号：亮色用 logo.svg、暗色用 logo-dark.svg（站内既有素材，样张只画了亮色那一版）。 */
  const mark = theme === 'dark' ? '/logo-dark.svg' : '/logo.svg';

  /* 刊名：首页用**全名**、内页用短名（2026-10-09 用户裁决「首页（只有首页）的标题是 The Set of Murmurs」）。
     中文站两者都是「呓语集」，所以这条在中文站上不改变任何一个字。 */
  const siteName = isHome ? t('brand.full') : t('brand.short');

  const nameplateLink = (
    <Link className="np-link" to="/">
      <img className="mark" src={mark} width={46} height={46} alt={t('brand.short')} />
      <span className="np-zh">{siteName}</span>
    </Link>
  );

  return (
    <div className="n1" style={vars}>
      <div className="wrap">
        {/* 报头：首页＝巨幅刊名（h1）／内页＝左上角小刊名（nav-inner），日期版次恒在右上角 */}
        <header className={`nav nav-mast${isHome ? '' : ' nav-inner'}`}>
          <div className="navmeta">
            <span className="nm-date">{dateText}</span>
            <span className="nm-issue">
              　·　{t('mast.issue', { n: issue })}
              {edition > 0 ? `　·　${t('mast.edition', { n: edition })}` : ''}
            </span>
            <span className="nm-site">　·　{SITE_DOMAIN}</span>
          </div>

          {isHome ? <h1 className="nameplate">{nameplateLink}</h1> : <div className="nameplate">{nameplateLink}</div>}

          {isHome ? (
            <>
              {/* ★ 2026-10-09 用户报「英文版主页大标题很丑，还重复，还遮挡按钮」★
                  这行拉丁刊名是给**中文**刊名做对照用的（「呓语集」＋ THE SET OF MURMURS），
                  但英文首页的大刊名本身就是这句拉丁名（`.np-zh` = The Set of Murmurs），
                  再排一行＝同一串词上下连写两遍 —— 这就是「重复」。
                  所以英文首页不出这一行；中文首页一个字未改。
                  回退＝把 `locale !== 'en' &&` 去掉即可。 */}
              {locale !== 'en' && <p className="npmotto" aria-hidden="true">{LATIN_NAME}</p>}
              <p className="npdeck">
                <b>{tagline}</b>
                <span className="npdeck-lede">{intro}</span>
              </p>
            </>
          ) : (
            <p className="npslogan">
              {tagline}
              <i>{LATIN_NAME}</i>
            </p>
          )}

          <nav className="navlinks">
            {/* 非博主（含访客）不出「写作」——见 N1_NAV 上方那段注释。 */}
            {N1_NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <Link key={item.to} to={item.to} className={item.match(pathname) ? 'on' : undefined}>
                {t(item.key)}
              </Link>
            ))}
          </nav>

          {/* ★ 报头右上角工具排（2026-10-09，用户原话「在现在的顶栏上面加上登录，开往，这两个按钮」）★
              样张在这一格里只画了一枚深浅切换（`.dm`），本轮把两枚新签排到它**左边**，
              `.dm` 自己一个像素都不挪（仍是贴版框右内缘那一格，页脚那枚「开往」徽章原样保留）。
              规格照 `.dm`：细线小签、10px 字、`--hair`/`--fg3` 两色，不新增色号。
              · 登录：登出时＝「登录」→ /login；已登录＝「个人主页」→ /profile
                （`/login` 对已登录的人不自动跳转，恒显「登录」对博主就是一枚死链）。
              · 开往：按 travellings 加入规则「打开网站就能看到」放报头，外链新开页。 */}
          <div className="navtools">
            {/* ★ 语言签（2026-10-09，用户问「英文站点不见了吗」）★
                N1 报头原先没有任何指向 /en 的**可点**入口（整页只有 head 里那三条 hreflang），
                而语言切换按钮只长在旧 Navbar 上、旧外壳又只剩 /friends、/profile 等几页 ——
                于是从首页/文章/书架… 这些主页面**走不进英文站**。这里把它补回报头：
                与「登录／开往」同款 `.nt` 小签（规格、token 一个不新增），排在工具排最左侧。
                用 <a href> 而不是 <Link>（与 Navbar 那枚同口径）：切语言＝换 URL 前缀，
                整页重载最干净，字典、<html lang>、首屏字体 preload 都得跟着换。
                文案走既有字典 `locale.switch`：中文站显示「EN」、英文站显示「中文」。 */}
            <a
              className="nt nav-lang"
              href={altHref()}
              title={t('locale.switchTitle')}
              aria-label={t('locale.switchTitle')}
              lang={locale === 'zh' ? 'en' : 'zh-CN'}
            >
              {t('locale.switch')}
            </a>
            {/* ★ 登录态（2026-10-09 三改：用户拍了「乙」——不要头像，两枚同族文字签）★
                一改＝把旧 Navbar 那枚「头像＋小菜单」搬回来（复原「退登录按钮没有了」）；
                二改＝撤掉重复的「个人主页」文字签、头像改方签；
                三改＝他看完三档渲染选了乙：**头像整个不要**，登录态就是两枚 `.nt` 小签
                （与 EN／开往／深 一模一样，零新元素、零浮层、零悬停）；
                未登录时仍是单枚「登录」小签。头像与小菜单的 state／effect／ref 一并删干净。
                要回甲或丙＝见 `first\n1-account-entry\`（甲＝头像方签＋小菜单；丙＝头像直链＋退出登录挪进个人主页）。 */}
            {user ? (
              <>
                <Link className="nt" to="/profile">{t('nav.myProfile')}</Link>
                <button type="button" className="nt" onClick={() => signOut()}>
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <Link className="nt" to="/login">{t('nav.signIn')}</Link>
            )}
            <a
              className="nt"
              href="https://www.travellings.cn/go.html"
              target="_blank"
              rel="noopener noreferrer"
              title={t('nav.travellingsTitle')}
            >
              {t('nav.travellingsShort')}
            </a>
            <button className="dm" type="button" aria-label={t('nav.switchTheme')} onClick={toggle}>
              <span className="dm-sun">{t('nav.lightShort')}</span>
              <span className="dm-moon">{t('nav.darkShort')}</span>
            </button>
          </div>
        </header>

        {children}

        {/* 报尾：双线夹 —— 符号 ＋ 刊名 ＋ 标语 ｜ 友链 · 开往 ＋ 开往徽章（照样张一字不差） */}
        <footer className="foot">
          <img className="fmark" src={mark} width={24} height={24} alt={t('brand.short')} />
          <span className="fname">{t('brand.short')}</span>
          <span className="fslogan">{slogan}</span>
          <span className="sp" />
          <span className="flabel">{t('foot.travellingsLabel')}</span>
          <a className="tww" href="https://www.travellings.cn/go.html" target="_blank" rel="noopener noreferrer" title={t('nav.travellingsTitle')}>
            <img src="/travellings/b.png" height={26} alt={t('nav.travellings')} />
          </a>
        </footer>
      </div>
    </div>
  );
}
