// Permite instalar la página y que abra aunque falle la señal. Los datos siempre van directo a Supabase.
const CACHE = 'sisero-admin-v3';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', '../config.js', '../assets/sisero-logo.png', '../assets/sisero-icono.png', '../assets/sisero-texto.png', '../assets/favicon.png', '../assets/icono-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sisero-admin') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.origin === location.origin || /jsdelivr|cdnjs|fonts\.g/.test(url.hostname))) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
