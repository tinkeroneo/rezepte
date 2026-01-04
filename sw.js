// sw.js - minimal offline cache for app shell (no build step)
const CACHE = "tinkeroneo-shell-v4-20260103";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./styles/tokens.css",
  "./styles/base.css",
  "./styles/components.css",
  "./styles/views.css",
  "./manifest.json",
  "./favicon.svg",
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
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't try to cache cross-origin (Supabase, etc.)
  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === "navigate" || req.headers.get("accept")?.includes("text/html");
  const isCodeAsset =
    req.destination === "script" ||
    req.destination === "style" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  // Network-first for HTML and for code assets (CSS/JS) to reduce "needs hard refresh" issues.
  if (isHtml || isCodeAsset) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (isHtml) {
          const shell = await caches.match("./index.html");
          return shell || new Response("Offline", { status: 503 });
        }
        return new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Cache-first for everything else (images, icons, etc.)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
      return res;
    } catch {
      return cached || new Response("Offline", { status: 503 });
    }
  })());
});
