const CACHE = 'bridge-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/BCO.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-152x152.png'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Assets might not exist yet, that's okay
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback + offline page
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls and analytics - let them go to network always
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('google')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        const clone = response.clone();
        if (response.status === 200) {
          caches.open(CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: try cache first, then show offline fallback
        return caches.match(event.request).then((cached) => {
          return cached || new Response(
            '<!doctype html><html><head><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;text-align:center;padding:40px;background:#eef0fa}h1{color:#0f5e9e}p{color:#666}a{color:#0f5e9e}</style></head><body><h1>🔌 You\'re Offline</h1><p>Check your connection and try again.</p><a href="/">Go Home</a></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
  );
});
