const CACHE_NAME = 'aquastrike-v3';

// Install: activate immediately, don't block on caching
self.addEventListener('install', (event) => {
  console.log('[SW] install event fired');
  self.skipWaiting();
});

// Activate: clean up old caches, take control
self.addEventListener('activate', (event) => {
  console.log('[SW] activate event fired');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: only intercept navigations for offline fallback
// Let everything else go straight to network to avoid interfering with PWA install
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET navigation requests
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode !== 'navigate') return;

  // Navigation: network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/')))
  );
});
