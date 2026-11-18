const CACHE_NAME = 'my-checklist-v1.3.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

// Install: Cache static shell assets & activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients for version:', CACHE_NAME);
      return self.clients.claim();
    })
  );
});

/**
 * Fetch with timeout helper to prevent hanging on flaky mobile networks
 */
function fetchWithTimeout(request, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Fetch event: Network-First for HTML, JS, CSS; Cache-First/Stale-While-Revalidate for images
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Bypass GitHub API calls from SW caching so Gist sync stays fresh and real-time
  if (url.hostname.includes('api.github.com')) {
    return;
  }

  // Identify code assets & navigation
  const isNavigation = request.mode === 'navigate';
  const pathname = url.pathname;
  const isCodeAsset = pathname.endsWith('.html') ||
                      pathname.endsWith('.js') ||
                      pathname.endsWith('.css') ||
                      pathname === '/' ||
                      pathname.endsWith('/');

  // 1. Network-First for HTML, JS, CSS and Page Navigation
  if (isNavigation || isCodeAsset) {
    event.respondWith(
      fetchWithTimeout(request, 2500)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed or timed out: Fallback to cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to index.html for navigation requests
          if (isNavigation) {
            const fallbackHtml = await caches.match('./index.html') || await caches.match('./');
            if (fallbackHtml) {
              return fallbackHtml;
            }
          }
          return new Response('Ngoại tuyến: Không thể nạp trang này.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        })
    );
    return;
  }

  // 2. Cache-First with Background Revalidation for static images/icons/fonts
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
