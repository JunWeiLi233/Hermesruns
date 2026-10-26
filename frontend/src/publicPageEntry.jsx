import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import AuthContext from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import Landing from './pages/landing/Landing';
import LegalPage from './pages/legal/LegalPage';
import { getSeoMetadata } from './utils/seoMetadata.js';

export function renderPublicPage(pathname) {
  if (!['/', '/terms', '/privacy'].includes(pathname)) throw new Error(`Not a public page: ${pathname}`);
  const content = renderToString(
    <StaticRouter location={pathname}>
      <I18nProvider initialLanguage="en">
        <AuthContext.Provider value={{ isAuthenticated: false, isAdmin: false, authHydrated: true }}>
          {pathname === '/' ? <Landing /> : <LegalPage variant={pathname.slice(1)} />}
        </AuthContext.Provider>
      </I18nProvider>
    </StaticRouter>,
  );
  return { content, metadata: getSeoMetadata(pathname, 'en') };
}
