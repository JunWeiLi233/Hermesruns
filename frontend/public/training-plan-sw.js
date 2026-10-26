/* Public application shell only. Auth and API responses never enter this cache. */
const SHELL = 'hermes-training-shell-v1';
const planPath = path => ['/schedule','/today-run','/runs','/training-plan'].includes(path) || path.startsWith('/training-plan/');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(async cache => {
    const response = await fetch('/training-plan', { credentials: 'omit' });
    if (response.ok) await cache.put('/training-plan', response);
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
let warming = Promise.resolve();
async function warmAssets(values) {
  const urls = [...new Set(values.slice(0, 128).flatMap(value => {
    try {
      const url = new URL(value, self.location.origin);
      return url.origin === self.location.origin && url.pathname.startsWith('/assets/') ? [url.href] : [];
    } catch { return []; }
  }))];
  const cache = await caches.open(SHELL);let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        if (await cache.match(url)) continue;
        const response = await fetch(url, { credentials: 'omit' });
        if (response.ok) await cache.put(url, response);
      } catch { /* reconnect later */ }
    }
  }));
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_PLAN_ASSETS' || !Array.isArray(event.data.urls)) return;
  // Navigating between plan screens can send overlapping asset inventories.
  warming = warming.catch(() => {}).then(() => warmAssets(event.data.urls));
  event.waitUntil(warming);
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && planPath(url.pathname)) {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) { const cache = await caches.open(SHELL); await cache.put('/training-plan', response.clone()); }
      return response;
    }).catch(async () => (await caches.open(SHELL)).match('/training-plan')));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) { const cache = await caches.open(SHELL); await cache.put(event.request, response.clone()); }
      return response;
    }).catch(async () => (await caches.open(SHELL)).match(event.request)));
  }
});
