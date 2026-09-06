// CamCam cache reset worker.
// Older builds registered a root/static service worker that could keep serving
// stale application HTML at the public marketing URL. CamCam no longer needs
// offline navigation caching, so this worker deliberately removes old caches
// and unregisters itself.
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try { client.postMessage({ type: 'CAMCAM_SW_RETIRED' }); } catch (_) {}
    }
  })());
});

// Intentionally no fetch handler: all navigation and media requests go to the
// network so product/landing updates cannot be shadowed by a stale cache.
