import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProviderBase } from './contexts/I18nProviderBase';
import { ThemeProvider } from './contexts/ThemeContext';
import * as publicRuntime from './i18n/publicTranslationRuntime';
import SeoHead from './components/SeoHead';
import Landing from './pages/landing/Landing';
const LazyLegalPage = lazy(() => import('./pages/legal/LegalPage'));

function PublicLegalPage({ initialLegal, variant }) {
  if (initialLegal) {
    const Legal = initialLegal;
    return <Legal variant={variant} />;
  }
  return <Suspense fallback={null}><LazyLegalPage variant={variant} /></Suspense>;
}

// Private destinations must load their own document/entry, including redirects
// made by the existing authenticated landing behavior. Preserve OAuth state.
const replaceDocument = (url) => window.location.replace(url);
export function LeavePublicApp({ replace = replaceDocument }) {
  const { pathname, search, hash } = useLocation();
  useEffect(() => { replace(`${pathname}${search}${hash}`); }, [pathname, search, hash, replace]);
  return null;
}

export default function PublicApp({ initialLegal }) {
  const renderYear = typeof document === 'undefined' ? undefined
    : Number(document.querySelector('[data-render-year]')?.getAttribute('data-render-year')) || undefined;
  return (
    <AuthProvider>
      <I18nProviderBase runtime={publicRuntime} initialLanguage="en" deferLanguageDetection>
        <ThemeProvider>
          <SeoHead />
          <Routes>
            <Route path="/" element={<Landing initialYear={renderYear} />} />
            <Route path="/terms" element={<PublicLegalPage initialLegal={initialLegal} variant="terms" />} />
            <Route path="/privacy" element={<PublicLegalPage initialLegal={initialLegal} variant="privacy" />} />
            <Route path="*" element={<LeavePublicApp />} />
          </Routes>
        </ThemeProvider>
      </I18nProviderBase>
    </AuthProvider>
  );
}
