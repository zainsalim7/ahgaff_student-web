// AHGAFF Students - Service Worker
// Cache versioning: bump CACHE_VERSION to force cache refresh on new deploys
const CACHE_VERSION = 'v1';
const CACHE_NAME = `ahgaff-students-${CACHE_VERSION}`;

// App shell resources to cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
// Pre-cache the app shell so the app loads offline immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate the new service worker without waiting for old tabs to close.
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Remove stale caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately.
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
// Strategy: Network-first for navigation requests (always try to get fresh
// HTML), Cache-first for static assets (JS, CSS, fonts, images).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Navigation requests (page loads) — network first, fall back to cached index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a fresh copy of the page.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then(
            (cached) => cached || new Response('Offline', { status: 503 })
          )
        )
    );
    return;
  }

  // Static assets — cache first, then network.
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }
});
