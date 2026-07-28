const CACHE = 'cm-trip-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 不缓存跨域(Tailwind/字体)

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html').then(m => m || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(c =>
      c || fetch(req).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(ca => ca.put(req, cp)); }
        return r;
      }).catch(() => c)
    )
  );
});
