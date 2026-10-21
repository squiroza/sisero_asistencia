// Guarda la app en el celular para que abra aunque no haya señal.
const CACHE = 'sisero-checador-v4';
const ESPERA_MS = 4000; // si la red no responde en 4 s, se usa lo guardado
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', '../config.js',
  '../assets/sisero-icono.png', '../assets/sisero-texto.png', '../assets/sisero-texto-blanco.png',
  '../assets/sisero-logo.png', '../assets/icono-192.png', '../assets/favicon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;            // los datos siempre van directo al servidor
  // Primero la red, pero con límite de espera: si tarda, se abre al instante con lo guardado
  // y la red sigue en segundo plano para actualizar la copia.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname.includes('jsdelivr') || url.hostname.includes('fonts.g'))) {
        cache.put(req, res.clone());
      }
      return res;
    });
    e.waitUntil(red.catch(() => {}));
    if (!guardado) return red;
    const limite = new Promise(r => setTimeout(() => r(null), ESPERA_MS));
    try { return (await Promise.race([red, limite])) || guardado; }
    catch (err) { return guardado; }
  })());
});
