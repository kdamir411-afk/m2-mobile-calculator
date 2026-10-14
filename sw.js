const CACHE = "m2-mobile-v5";
const CORE = ["./", "./index.html", "./manifest.json"];
const cleanHtml = html => html.replace('placeholder="Например: Дамир 6303"', 'placeholder=""');

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const index = await fetch("./index.html", {cache:"no-store"});
    const html = cleanHtml(await index.text());
    await cache.put("./index.html", new Response(html, {headers:{"Content-Type":"text/html; charset=utf-8"}}));
    const manifest = await fetch("./manifest.json", {cache:"no-store"});
    await cache.put("./manifest.json", manifest);
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
    event.respondWith(fetch(event.request, {cache:"no-store"}).then(async response => {
      const html = cleanHtml(await response.text());
      const cleaned = new Response(html, {status:response.status,statusText:response.statusText,headers:{"Content-Type":"text/html; charset=utf-8"}});
      const copy = cleaned.clone();
      caches.open(CACHE).then(cache => cache.put("./index.html", copy)).catch(()=>{});
      return cleaned;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(()=>{});
    return response;
  }).catch(() => caches.match(event.request)));
});