// IMPORTANT: Bump this version when deploying changes.
// Keep in sync with APP_VERSION in src/version.ts
const CACHE_NAME = 'bella-mozzarella-v1.1.0';

// Install: skipWaiting to activate immediately
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Don't intercept Supabase API calls
  if (url.hostname.includes('supabase')) return;

  // Only handle GET
  if (e.request.method !== 'GET') return;

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // HTML navigation requests: NETWORK-FIRST with cache fallback.
  // This guarantees users always get the latest index.html (which points
  // to the latest hashed bundle), instead of a stale cached HTML that
  // references an old broken bundle.
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || caches.match('/BellaMozzarella/')))
    );
    return;
  }

  // Other same-origin GET (hashed assets): stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
