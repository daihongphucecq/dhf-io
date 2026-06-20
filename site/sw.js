/* sw.js — service worker for dhf.io.vn
 * Strategy:
 *   - documents (HTML navigations): network-first, fall back to cache, then to "/" offline.
 *   - static assets (css/js/img/font): cache-first, revalidate in the background.
 *   - never intercept the API (/api) or the PocketBase panel (/_/): always network.
 * Bump CACHE on release to invalidate old entries (activate prunes them).
 */
const CACHE = 'dhf-v1';
const PRECACHE = ['/', '/index.html', '/hydrate.js', '/favicon.svg', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // only handle our own GETs; let the API / admin panel hit the network directly
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return;

  // documents: network-first (fresh content), cache + offline fallback
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // static assets: cache-first, populate on miss
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
