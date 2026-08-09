/* CDS Photography service worker — app shell + offline, installability. */
const CACHE = 'cds-photo-v2';
const SHELL = [
  './',
  './assets/styles.css',
  './assets/app.js',
  './assets/pwa.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first with offline fallback: keeps content fresh, works offline.
const networkFirst = (request) =>
  fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || caches.match('./')));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin

  // Do NOT intercept images. Responsive <img srcset> loading is sensitive to
  // SW interference, and the optimized files are already fingerprinted and
  // HTTP-cached — letting the browser handle them natively is both safe and fast.
  if (request.destination === 'image') return;

  event.respondWith(networkFirst(request));
});
