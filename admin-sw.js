/* ══════════════════════════════════════════════════════════════
   عامل الخدمة — لوحة تحكم أمواج

   يسوي شغلتين:
     ١) يخلي اللوحة تتنصّب وتفتح بسرعة (تخزين الهيكل)
     ٢) يستقبل الإشعارات واللوحة مسكّرة

   ⚠️ ليش الاثنين بملف واحد:
      المتصفح يسمح بعامل خدمة **واحد** لكل نطاق. لو سجّلنا
      admin-sw.js و firebase-messaging-sw.js على نفس النطاق،
      الثاني يلغي الأول — فإما تضيع الإشعارات أو يضيع التنصيب.

   ⚠️ ولا نخزّن أي بيانات: كل شي يجي من سوبابيس (طلبات، زبائن)
      يمر مباشرة للشبكة. لو خزّناه ممكن تشوف طلب قديم وتظنه
      الحالي — وهذا أخطر من إنك ما تشوف شي.
   ══════════════════════════════════════════════════════════════ */

const V = 'amwaj-panel-v2';
const SHELL = [
  '/admin.html',
  '/sb-config.js',
  '/pwa-192.png',
  '/pwa-512.png',
];

/* ── ١) التنصيب والتخزين ── */

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // سوبابيس وفايربيس
  if (url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/functions/')) return;

  // الصفحة: الشبكة أول، والمخزّن احتياط لو ماكو نت
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(V).then((c) => c.put(req, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/admin.html')))
    );
    return;
  }

  // الأيقونات والإعدادات: المخزّن أول، ونحدّثها بالخلفية
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(V).then((c) => c.put(req, copy)).catch(() => {});
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});


/* ── ٢) الإشعارات ── */

try {
  importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
  importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

  firebase.initializeApp({
    apiKey: "AIzaSyBcH823LBDN9CcBk47eUlaQEyQKe4qgOfs",
    authDomain: "amwaj-electronics.firebaseapp.com",
    projectId: "amwaj-electronics",
    storageBucket: "amwaj-electronics.firebasestorage.app",
    messagingSenderId: "680328798771",
    appId: "1:680328798771:web:79b848045402abe3b2b946"
  });

  firebase.messaging().onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const n = payload.notification || {};
    const title = n.title || d._title || 'أمواج';
    const body  = n.body  || d._body  || '';

    return self.registration.showNotification(title, {
      body: body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: 'amwaj-panel-' + (d.type || 'x'),
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300],
      data: d
    });
  });
} catch (e) {
  // ما ينزل فايربيس؟ التنصيب والتخزين يبقون شغّالين
  console.warn('[sw] firebase:', e && e.message);
}

/* ضغط على الإشعار → نفتح اللوحة أو نرجّعها للواجهة لو مفتوحة */
const PAGE_OF = {
  admin_new_customer:   'cust',
  admin_new_order:      'ord',
  admin_order_cancelled:'ord',
  test:                 'home',
};

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const page = PAGE_OF[d.type] || 'ord';
  const target = '/admin.html#' + page;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.indexOf('/admin.html') !== -1 && 'focus' in c) {
          c.postMessage({ amwaj: 'open', page: page });
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
