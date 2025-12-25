// sw.js - minimal offline cache for app shell (no build step)
const CACHE = "tinkeroneo-shell-v2-20251224";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./favicon.svg",
  "./manifest.json",
  "./wakelock.js",
  "./src/app.js",
  "./src/state.js",
  "./src/storage.js",
  "./src/utils.js",
  "./src/supabase.js",
  "./src/domain/recipes.js",
  "./src/domain/recipeRepo.js",
  "./src/domain/import.js",
  "./src/domain/id.js",
  "./src/domain/ingredients.js",
  "./src/domain/steps.js",
  "./src/domain/shopping.js",
  "./src/domain/timers.js",
  "./src/domain/parts.js",
  "./src/domain/images.js",
  "./src/domain/cooklog.js",
  "./src/services/errors.js",
  "./src/services/locks.js",
  "./src/services/wakeLock.js",
  "./src/services/pdfExport.js",
  "./src/services/exportDownload.js",
  "./src/views/list.view.js",
  "./src/views/detail.view.js",
  "./src/views/cook.view.js",
  "./src/views/add.view.js",
  "./src/views/shopping.view.js",
  "./src/views/selftest.view.js",
  "./src/views/timers.view.js",
  "./src/views/diagnostics.view.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Allow the page to trigger immediate activation on deploy
self.addEventListener("message", (event) => {
  if (event && event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't try to cache cross-origin (Supabase, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML, cache-first for others
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match("./index.html");
        // return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" }});
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
    return res;
  })());
});
