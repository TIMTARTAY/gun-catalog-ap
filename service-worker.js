const CACHE_NAME="firearm-catalog-v7-2-3-2026-08-03-1";
const STATIC_ASSETS=["./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 if(event.request.mode==="navigate"||new URL(event.request.url).pathname.endsWith("/index.html")){
  event.respondWith(fetch(event.request,{cache:"no-store"}).catch(()=>caches.match("./index.html")));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy))}return r})));
});
