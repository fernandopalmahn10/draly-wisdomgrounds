// Draly Wisdom Grounds · service worker for the home-screen app (2026-10-12).
// Deliberately tiny: pages, homework, audios and live games ALWAYS come fresh from the network (a cached page would show
// a class stale content), so it caches nothing but its own offline page. It does three things:
//   1. no internet → a friendly «Sin conexión» page instead of the browser's error (page loads only);
//   2. shows push notifications (ready for when the platform starts sending them);
//   3. tapping a notification opens (or focuses) the page it points to.
// Bump VERSION when offline.html or its pictures change.
const VERSION = 'draly-sw-2';   // 2: offline.html got its «← Volver» (2026-10-18)
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/assets/app/icon-192.png', '/assets/dralingo/anim/wise-still.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // the offline page's own pictures (only ever asked for by offline.html)
  if (PRECACHE.includes(new URL(req.url).pathname) && new URL(req.url).origin === self.location.origin) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  if (req.mode !== 'navigate') return;                       // API calls, sockets, files: untouched
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Dralingo', {
    body: d.body || '',
    icon: '/assets/app/icon-192.png',
    badge: '/assets/app/icon-192.png',
    tag: d.tag || undefined,
    lang: 'es',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;           // only pages of this site
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url === url.href && 'focus' in c) return c.focus();
    return self.clients.openWindow(url.href);
  }));
});
