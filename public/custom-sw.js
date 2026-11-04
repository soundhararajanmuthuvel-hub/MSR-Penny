// MSR Penny - Custom Service Worker extensions for Web Push & Notifications
// Loaded via workbox importScripts in VitePWA

self.addEventListener('push', function (event) {
  let payload = {
    title: 'MSR Penny Reminder',
    body: "Don't forget to log your expenses for today 🪙",
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    data: { url: '/#add-expense' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = Object.assign({}, payload, parsed);
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: payload.data || { url: '/#add-expense' },
    actions: [
      { action: 'add-expense', title: 'Add Expense' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/#add-expense';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

