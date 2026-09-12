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
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// 路由级代码分割：重页面（Markdown/KaTeX/编辑器/阅读器等）按需加载，减小首屏体积
const Home = lazy(() => import('./pages/Home'));
const Articles = lazy(() => import('./pages/Articles'));
const SectionPage = lazy(() => import('./pages/SectionPage'));
const Novels = lazy(() => import('./pages/Novels'));
const ArticleDetail = lazy(() => import('./pages/ArticleDetail'));
const Write = lazy(() => import('./pages/Write'));
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FooterProvider>
          <ProfileProvider>
            <AboutProvider>
              <GalleryProvider>
                <ArticleProvider>
                  <CommentProvider>
                    <FriendLinkProvider>
                      <BrowserRouter>
                        <ErrorBoundary>
                          <Suspense fallback={<div className="route-loading">加载中…</div>}>
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
  );
}
