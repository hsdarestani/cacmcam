// CamCam root-bridge service worker.
// Old builds cached the root application shell and can keep serving it even
// after the server is updated. This worker deliberately keeps NO cache and
// only takes over navigation to the public root, serving the fresh marketing
// landing from /landing. Keeping the worker registered is intentional: it
// replaces any stale root-scoped worker even while other CamCam tabs are open.

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try { client.postMessage({ type: 'CAMCAM_SW_CURRENT' }); } catch (_) {}
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.mode !== 'navigate') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The historical stale shell only affected the public root/index entrypoint.
  // Serve the current landing HTML directly, bypassing every browser cache.
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith((async () => {
      try {
        return await fetch('/landing?swfresh=' + Date.now(), {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          redirect: 'follow',
          headers: { 'X-CamCam-SW': 'root-bridge-v1' }
        });
      } catch (_) {
        return Response.redirect('/landing?offline_recover=' + Date.now(), 302);
      }
    })());
  }
});
