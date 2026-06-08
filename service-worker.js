// Service Worker لـ طالب الأحقاف PWA
// يدعم: caching آمن (Network-first للكل) + push notifications
// ملاحظة: نتجنّب Cache-first للـ JS bundles لأن أسماءها تتغير عند كل deploy

const CACHE_VERSION = 'ahgaff-student-v4';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_FALLBACK_CACHE = `${CACHE_VERSION}-offline`;

// عند تثبيت Service Worker - تنشيط فوري بدون انتظار
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_FALLBACK_CACHE).then((cache) =>
      cache.add('/').catch(() => {})
    )
  );
  self.skipWaiting();
});

// عند التفعيل - احذف كل الـ caches القديمة (إنقاذ المستخدمين العالقين)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// استراتيجية: Network-first للكل
// - عند الفشل التام: نرجع index.html من الكاش (للـ SPA navigation فقط)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات غير-GET
  if (request.method !== 'GET') return;

  // تجاهل الطلبات غير-http (مثل chrome-extension)
  if (!url.protocol.startsWith('http')) return;

  // تجاهل طلبات من origins مختلفة (CDN, fonts, etc.) - دعها للمتصفح
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        // Network-first دائماً
        const networkResponse = await fetch(request);

        // كاش الردود الناجحة فقط (للـ navigation كـ fallback)
        if (networkResponse.ok && request.mode === 'navigate') {
          const clone = networkResponse.clone();
          caches.open(OFFLINE_FALLBACK_CACHE).then((cache) =>
            cache.put('/', clone).catch(() => {})
          ).catch(() => {});
        }

        return networkResponse;
      } catch (e) {
        // الشبكة فشلت - استخدم cache كـ fallback فقط لـ navigation
        if (request.mode === 'navigate') {
          const cached = await caches.match('/');
          if (cached) return cached;
        }
        // للأشياء الأخرى (JS/CSS/images) - دع المتصفح يعطي خطأ طبيعي
        throw e;
      }
    })()
  );
});

// ===== Push Notifications =====
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'طالب الأحقاف', body: event.data?.text() || 'إشعار جديد' };
  }

  const title = data.title || 'طالب الأحقاف';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'ahgaff-notification',
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// عند الضغط على الإشعار - افتح الرابط
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// رسالة من الصفحة لـ skipWaiting (تحديث فوري)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
