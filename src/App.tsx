import { HashRouter, Routes, Route, Outlet, useOutletContext } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ArticleProvider } from './context/ArticleProvider';
import { CommentProvider } from './context/CommentContext';
import { ProfileProvider } from './context/ProfileContext';
import { AboutProvider } from './context/AboutContext';
import { FooterProvider } from './context/SiteTextContext';
import { ThemeProvider } from './context/ThemeContext';
import { GalleryProvider } from './context/GalleryContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Articles from './pages/Articles';
import SectionPage from './pages/SectionPage';
import Novels from './pages/Novels';
import ArticleDetail from './pages/ArticleDetail';
import Write from './pages/Write';
import About from './pages/About';
import Guestbook from './pages/Guestbook';
import Gallery from './pages/Gallery';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';

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
              <HashRouter>
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
                    <Route path="*" element={<HomeRoute />} />
                </Route>
              </Routes>
            </HashRouter>
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

