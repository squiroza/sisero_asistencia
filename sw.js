// Permite instalar la página y que abra aunque falle la señal. Los datos siempre van directo a Supabase.
const CACHE = 'sisero-inicio-v2';
const ESPERA_MS = 4000; // si la red no responde en 4 s, se usa lo guardado
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './assets/sisero-logo.png', './assets/favicon.png', './assets/icono-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sisero-inicio') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  // Primero la red con límite de espera: si tarda, abre al instante con lo guardado
  // y la red sigue en segundo plano para actualizar la copia.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin || /jsdelivr|cdnjs|fonts\.g/.test(url.hostname))) cache.put(req, res.clone());
      return res;
    });
    e.waitUntil(red.catch(() => {}));
    if (!guardado) return red;
    const limite = new Promise(r => setTimeout(() => r(null), ESPERA_MS));
    try { return (await Promise.race([red, limite])) || guardado; }
    catch (err) { return guardado; }
  })());
});
