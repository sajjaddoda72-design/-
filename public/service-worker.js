// EcoSynth Service Worker — cache-first for app shell only
const CACHE_NAME = 'ecosynth-cache-v1';

// App shell files to pre-cache on install.
// Vite hashed assets (JS/CSS) are caught by the runtime fetch handler.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ---- Activate: delete old versioned caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ---- Fetch: cache-first for same-origin app shell & hashed assets ----
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests for same-origin resources
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache hashed assets
      return fetch(request).then((response) => {
        // Only cache successful responses for app assets (JS, CSS, HTML, images)
        if (
          response.ok &&
          (request.url.includes('/assets/') ||
            request.url.endsWith('.html') ||
            request.url.endsWith('.png') ||
            request.url.endsWith('.jpg') ||
            request.url.endsWith('.json') ||
            request.url.endsWith('/'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
