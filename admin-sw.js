/* ══════════════════════════════════════════════════════════════
   عامل الخدمة — لوحة تحكم أمواج

   وظيفته: يخلي اللوحة تتنصّب بالشاشة الرئيسية وتفتح بسرعة.

   ⚠️ القاعدة الذهبية هنا: **لا نخزّن أي بيانات**.
      كل شي يجي من سوبابيس (طلبات، زبائن، أسعار) يمر مباشرة
      للشبكة بلا لمس. لو خزّنّاه، ممكن تشوف طلب قديم وتظن إنه
      الحالي — وهذا أخطر من إنك ما تشوف شي.

      نخزّن الهيكل بس: صفحة اللوحة والأيقونات.

   والصفحة نفسها «الشبكة أول»: إذا أنته أونلاين تاخذ آخر نسخة
   دائماً، والمخزّن احتياط لو انقطع النت.
   ══════════════════════════════════════════════════════════════ */

const V = 'amwaj-panel-v1';
const SHELL = [
  '/admin.html',
  '/sb-config.js',
  '/pwa-192.png',
  '/pwa-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V)
      // ما نخلي فشل ملف واحد يوقف التنصيب كله
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

  // بيانات ونداءات السيرفر — ما نلمسها أبداً
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // سوبابيس وغيره
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

  // الأيقونات والإعدادات: المخزّن أول (تفتح فوراً)، ونحدّثها بالخلفية
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
