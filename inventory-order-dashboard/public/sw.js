const STATIC_CACHE = "wobuy174-static-v1";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", () => {
  // Never cache API results or authenticated HTML. This backend is installable as an
  // app, but orders, payments and inventory always require a live server connection.
});
