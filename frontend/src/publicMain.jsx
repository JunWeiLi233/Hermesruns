import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import PublicApp from './PublicApp';
import './styles/public-entry.css';
import { clearStaleAssetReloadGuard, isChunkLoadFailure, isStaleAssetElement, reloadForStaleAsset } from './utils/staleAssetRecovery';

window.addEventListener('load', clearStaleAssetReloadGuard);
window.addEventListener('error', (event) => {
  if (isChunkLoadFailure(event.error || event.message) || isStaleAssetElement(event.target)) reloadForStaleAsset();
}, true);
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadFailure(event.reason)) reloadForStaleAsset();
});

const root = document.getElementById('root');
// Anonymous prerenders deliberately use English. The provider applies saved or
// system language after hydration. Returning sessions can change the legal
// back-link immediately, so use their existing client-rendering behavior.
const hasIncomingAuth = new URLSearchParams(window.location.search).has('token')
  || new URLSearchParams(window.location.hash.slice(1)).has('token');
async function mountPublicPage() {
  // Direct legal visits hydrate their existing content after loading that
  // route. Homepage visits never download its copy or stylesheet at startup.
  const initialLegal = ['/terms', '/privacy'].includes(window.location.pathname)
    ? (await import('./pages/legal/LegalPage')).default : undefined;
  const app = <BrowserRouter><PublicApp initialLegal={initialLegal} /></BrowserRouter>;
  if (localStorage.getItem('hermes_jwt') || hasIncomingAuth || !root.hasChildNodes()) {
    createRoot(root).render(app);
  } else {
    hydrateRoot(root, app);
  }
}
void mountPublicPage();
