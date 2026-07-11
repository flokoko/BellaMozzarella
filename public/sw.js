const CACHE_NAME = 'bella-mozzarella-v2';
const ASSETS = [
  '/BellaMozzarella/',
  '/BellaMozzarella/manifest.json',
  '/BellaMozzarella/icon-192.png',
  '/BellaMozzarella/icon-512.png',
];

// Install: cache static shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/Supabase, cache-first for static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Don't intercept Supabase API calls — always network
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Cache-first for same-origin GET requests
  if (e.request.method === 'GET' && url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
            return response;
          })
          .catch(() => cached); // Offline: fall back to cache
        return cached || fetchPromise;
      })
    );
  }
});