const CACHE = "m2-mobile-v16";
const CORE = ["./", "./index.html", "./app.html", "./manifest.json", "./access.js?v=5"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    for (const url of CORE) {
      try {
        const response = await fetch(url, {cache:"no-store"});
        if (response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }
  }));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, {cache:"no-store"}).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put("./index.html", copy)).catch(()=>{});
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request, {cache:"no-store"}).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(()=>{});
    }
    return response;
  }).catch(async () => {
    const exact = await caches.match(event.request);
    if (exact) return exact;
    const url = new URL(event.request.url);
    if (url.pathname.endsWith('/app.html')) return caches.match('./app.html');
    if (url.pathname.endsWith('/access.js')) return caches.match('./access.js?v=5');
    return caches.match(event.request, {ignoreSearch:true});
  }));
});