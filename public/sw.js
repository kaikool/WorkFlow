const CACHE_NAME = 'workflow-v1';
const STATIC_CACHE = 'workflow-static-v1';

// Tài nguyên immutable (có hash trong tên file) — cache vĩnh viễn
const PRECACHE_URLS = [
  '/',
  '/dashboard',
];

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('[Service Worker] Precache failed (non-critical):', err);
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  // Xoá cache cũ nếu có
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(name) {
          if (name !== STATIC_CACHE && name !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Cache-first cho _next/static (immutable), network-first cho API/data
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Chỉ xử lý request cùng origin
  if (url.origin !== self.location.origin) return;

  // Cache-first: _next/static có hash → immutable
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          return caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Cache-first: font, image, icon file
  if (url.pathname.match(/\.(woff2?|ttf|otf|svg|png|jpg|jpeg|gif|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          return caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }
});

// Push notification (giữ nguyên)
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Thông báo mới từ WorkFlow';
      const options = {
        body: data.body || 'Bạn có một cập nhật mới trong công việc.',
        icon: '/icon-512.png',
        badge: '/icon-512.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/dashboard' },
        actions: [{ action: 'open_url', title: 'Xem ngay' }]
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
