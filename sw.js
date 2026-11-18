const CACHE = 'exam-app-v30';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon192.png',
  './icon512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const url of APP_SHELL) {
      try { await c.add(url); } catch (err) { console.warn('SW skip:', url); }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API — কখনো cache নয়
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('firebasestorage.googleapis.com')) {
    return;
  }

  // HTML / navigation → network-first
  if (e.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy).catch(() => {}));
        }
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // বাকি সব → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || !res.ok) return res;
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy).catch(() => {}));
        return res;
      }).catch(() => new Response('', { status: 503, statusText: 'Offline' }));
    })
  );
});