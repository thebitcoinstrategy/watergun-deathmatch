const CACHE_NAME = 'aquastrike-v1';

// Core assets to precache on install (shell of the app)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate: clean up old caches
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
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch: stale-while-revalidate for all same-origin requests
// This ensures offline play works while keeping assets fresh
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin requests (e.g. Colyseus WebSocket)
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // For navigation requests, try network first (short timeout), fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // For assets: serve from cache, update in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    )
  );
});
