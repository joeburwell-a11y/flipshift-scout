// FlipShift Scout — Service Worker
// Version: bump this string to force cache refresh on update
const CACHE_NAME = "fss-v1";

// Files to cache on install (app shell)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"
];

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching app shell");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Take control immediately without waiting for old SW to retire
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network-first for API calls ───────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Anthropic API calls — always go live
  if (url.hostname === "api.anthropic.com") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never cache Gmail compose links
  if (url.hostname === "mail.google.com") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (app shell, CDN scripts)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type === "error") {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});

// ── NOTE on iOS background scheduling ────────────────────────────────────────
// iOS Safari kills PWA background processes. The scheduler in this app
// (auto-scan at a set time) will ONLY fire when the app is open and in the
// foreground. Background sync is not supported on iOS PWAs.
// Workaround: remind the user to open the app daily, or use a Shortcut
// automation on iPhone (Shortcuts app → Automation → Time of Day → Open URL).
