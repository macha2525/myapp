self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// 通知が届いたとき
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Life App';
  const options = {
    body: data.body || '',
    icon: '/pwa-icon?size=192',
    badge: '/pwa-icon?size=96',
    data: { url: data.url || '/' },
  };

  // iPhoneは、通知が届いたら必ず表示する決まり(黙って受け取るのは不可)
  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知をタップしたとき
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});