// Service Worker لتطبيق طالب الأحقاف PWA
const CACHE_NAME = 'ahgaff-student-v1';
const ASSETS_CACHE = 'ahgaff-assets-v1';

// الملفات الأساسية للتخزين عند التثبيت
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// التثبيت - تخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

// التفعيل - حذف الكاشات القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== ASSETS_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// استراتيجية Fetch:
// - API calls (لا تُخزن) → network only
// - Static assets (JS/CSS/fonts/images) → cache-first
// - HTML → network-first مع fallback للـ cache
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // تجاهل طلبات API (الباك إند)
  if (url.hostname.includes('railway.app') && url.pathname.startsWith('/api/')) {
    return;
  }
  if (url.hostname !== self.location.hostname) {
    // طلب خارجي (مثل Railway backend)
    return;
  }

  // أصول ثابتة: cache-first
  if (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|ttf|otf|woff|woff2|js|css)$/)
  ) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((response) => {
            if (response.ok) cache.put(req, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // HTML & navigation: network-first
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});
