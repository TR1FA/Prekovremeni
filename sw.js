// Service worker: aplikacija radi i bez interneta. Povecaj CACHE pri svakoj novoj verziji.
const CACHE = 'prekovremeni-1.0.0';
const SHELL = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/core.js', 'js/excel.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // GitHub API ide direktno
  if (url.pathname.includes('/data/')) {
    // podaci: prvo mreza, a bez interneta zadnja kopija
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); }
      return r;
    }).catch(() => caches.match(url.pathname).then((hit) => hit || Response.error())));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok && url.pathname.endsWith('/lib/exceljs.min.js')) {
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return r;
  })));
});
