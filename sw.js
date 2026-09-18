const CACHE_NAME = 'resume-builder-v2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './data.html',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js'
];

// Install Event - Pre-caching Static Assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching All Static Assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting Old Cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Dynamic Smart Caching Strategy
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 1. Firebase API / External Live Requests -> Network First Strategy
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('firebase')) {
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // 2. Static Assets & Pages -> Stale-While-Revalidate Strategy
  e.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && req.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline Page Fallback for Navigation
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
