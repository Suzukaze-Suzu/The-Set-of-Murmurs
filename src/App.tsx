import { BrowserRouter, Routes, Route, Outlet, useOutletContext } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ArticleProvider } from './context/ArticleProvider';
import { CommentProvider } from './context/CommentContext';
import { ProfileProvider } from './context/ProfileContext';
import { AboutProvider } from './context/AboutContext';
import { FooterProvider } from './context/SiteTextContext';
import { ThemeProvider } from './context/ThemeContext';
import { GalleryProvider } from './context/GalleryContext';
import { FriendLinkProvider } from './context/FriendLinkContext';
import { TranslationProvider } from './context/TranslationContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { LocaleProvider, localeFromPath, basenameFor, useT } from './i18n';

// ★ 英文版（路线 B，2026-09-21）★
// 语言**只由 URL 决定**：/en 前缀＝英文线，其余＝中文线（原样不动）。
// 用 react-router 的 basename 承载语言前缀，于是下面所有 <Route path="/articles" />
// 与页面里现存的 <Link to="/articles"> 都自动变成 /en/articles——全站路由代码零改动。
// 切语言＝换 URL（整页跳转）。不做前端静默切语言：一个 URL 只能对应一种语言，
// 否则分享出去的链接会随对方浏览器语言变样，hreflang 也会自相矛盾。
const LOCALE = localeFromPath(typeof window === 'undefined' ? '/' : window.location.pathname);

// 路由级代码分割：重页面（Markdown/KaTeX/编辑器/阅读器等）按需加载，减小首屏体积
const Home = lazy(() => import('./pages/Home'));
const Articles = lazy(() => import('./pages/Articles'));
const SectionPage = lazy(() => import('./pages/SectionPage'));
const Novels = lazy(() => import('./pages/Novels'));
const ArticleDetail = lazy(() => import('./pages/ArticleDetail'));
const Write = lazy(() => import('./pages/Write'));
const Translations = lazy(() => import('./pages/Translations'));
const About = lazy(() => import('./pages/About'));
const Guestbook = lazy(() => import('./pages/Guestbook'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Friends = lazy(() => import('./pages/Friends'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// 使用 Outlet context 传递搜索词
function LayoutRoute() {
  return <Layout />;
}
function GetQuery() {
  return useOutletContext<{ query: string }>();
}

function HomeRoute() {
  const { query } = GetQuery();
  return <Home query={query} />;
}

function ArticlesRoute() {
  const { query } = GetQuery();
  return <Articles query={query} />;
}

// 路由懒加载时的过场文案：跟随当前语言（在 LocaleProvider 之下）
function RouteLoading() {
  const t = useT();
  return <div className="route-loading">{t('common.loading')}</div>;
}

export default function App() {
  return (
    <LocaleProvider locale={LOCALE}>
      {/* 译文上下文要挂在 LocaleProvider 之下（它按当前语言决定读不读译文表）；
          中文线在它内部直接短路，一个请求都不发 */}
      <TranslationProvider>
      <ThemeProvider>
        <AuthProvider>
          <FooterProvider>
            <ProfileProvider>
              <AboutProvider>
                <GalleryProvider>
                  <ArticleProvider>
                    <CommentProvider>
                      <FriendLinkProvider>
                        <BrowserRouter basename={basenameFor(LOCALE)}>
                          <ErrorBoundary>
                            <Suspense fallback={<RouteLoading />}>
                              <Routes>
                                <Route path="/login" element={<LoginPage />} />
                                <Route element={<LayoutRoute />}>
                                  <Route path="/" element={<HomeRoute />} />
                                  <Route path="/articles" element={<ArticlesRoute />} />
                                  <Route path="/gallery" element={<Gallery />} />
                                  <Route path="/novels" element={<Novels />} />
                                  <Route path="/category/:category" element={<SectionPage />} />
                                  <Route path="/article/:id" element={<ArticleDetail />} />
                                  <Route path="/write" element={<Write />} />
                                  {/* 静态段优先于 :id（v6 按具体度排序），
                                      所以 /write/translations 不会被 /write/:id 抢走 */}
                                  <Route path="/write/translations" element={<Translations />} />
                                  <Route path="/write/:id" element={<Write />} />
                                  <Route path="/about" element={<About />} />
                                  <Route path="/profile" element={<ProfilePage />} />
                                  <Route path="/guestbook" element={<Guestbook />} />
                                  <Route path="/friends" element={<Friends />} />
                                  <Route path="*" element={<HomeRoute />} />
                                </Route>
                              </Routes>
                            </Suspense>
                          </ErrorBoundary>
                        </BrowserRouter>
                      </FriendLinkProvider>
                    </CommentProvider>
                  </ArticleProvider>
                </GalleryProvider>
              </AboutProvider>
            </ProfileProvider>
          </FooterProvider>
        </AuthProvider>
      </ThemeProvider>
      </TranslationProvider>
    </LocaleProvider>
  );
}
