// EcoSynth Service Worker v2 — network-first for HTML, cache-first for hashed assets
const CACHE_NAME = 'ecosynth-cache-v2';

// Static assets to pre-cache on install (icons, manifest — NOT index.html)
const PRECACHE = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ---- Install ----
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ---- Activate: delete ALL old caches ----
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ---- Fetch ----
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // NETWORK-FIRST for navigation requests and index.html
  // This ensures users always get the latest HTML
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML for offline fallback
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — serve from cache
          console.log('[SW] Network failed, serving cached:', url.pathname);
          return caches.match(request);
        })
    );
    return;
  }

  // CACHE-FIRST for Vite hashed assets (/assets/index-XXXX.js, /assets/index-XXXX.css)
  // These have content hashes in filenames so they're immutable
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // NETWORK-FIRST for everything else (manifest, icons, etc.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
