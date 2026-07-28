// IMPORTANT: Bump this version when deploying changes.
// Keep in sync with APP_VERSION in src/version.ts
const CACHE_NAME = 'bella-mozzarella-v1.0.0';

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

// Fetch: stale-while-revalidate for same-origin GET, skip Supabase API
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Don't intercept Supabase API calls
  if (url.hostname.includes('supabase')) return;

  // Only handle GET
  if (e.request.method !== 'GET') return;

  // Same-origin: stale-while-revalidate
  if (url.origin === self.location.origin) {
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
  }
});