// Guarda la app en el celular para que abra aunque no haya señal.
const CACHE = 'sisero-checador-v10';
const ESPERA_MS = 4000; // si la red no responde en 4 s, se usa lo guardado
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', '../config.js',
  '../assets/sisero-icono.png', '../assets/sisero-texto.png', '../assets/sisero-texto-blanco.png',
  '../assets/sisero-logo.png', '../assets/icono-192.png', '../assets/favicon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

// Instala la versión nueva descargando cada archivo fresco del servidor (sin usar copias viejas del navegador).
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ARCHIVOS.map(async u => {
      const r = await fetch(new Request(u, { cache: 'reload' }));
      if (!r.ok) throw new Error('No se pudo descargar ' + u);
      await c.put(u, r);
    }));
    await self.skipWaiting();   // la versión nueva toma el control sin esperar a que cierren la app
  })());
});
// Al activarse: borra las copias viejas del checador y, si venía de una versión anterior,
// recarga las ventanas abiertas para que el celular quede con la versión nueva sin que nadie haga nada.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    const viejas = ks.filter(k => k.startsWith('sisero-checador') && k !== CACHE);
    await Promise.all(viejas.map(k => caches.delete(k)));
    await self.clients.claim();
    if (viejas.length) {
      const ventanas = await self.clients.matchAll({ type: 'window' });
      ventanas.forEach(w => { try { w.navigate(w.url).catch(() => {}); } catch (err) {} });
    }
  })());
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
