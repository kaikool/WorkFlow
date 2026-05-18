self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Thông báo mới từ WorkFlow';
      const options = {
        body: data.body || 'Bạn có một cập nhật mới trong công việc.',
        icon: '/icon-512.png',
        badge: '/icon-512.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/dashboard'
        },
        actions: [
          {
            action: 'open_url',
            title: 'Xem ngay'
          }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  if (event.action === 'open_url' || !event.action) {
    const urlToOpen = event.notification.data.url;
    
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(function(windowClients) {
        // Check if there is already a window open and focus it
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating Service Worker...');
});
