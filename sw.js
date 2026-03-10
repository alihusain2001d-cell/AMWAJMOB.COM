// ════════════════════════════════════════════════
//  Service Worker — إشعارات الموبايل الحقيقية
//  هذا الملف يشتغل في الخلفية حتى لو الصفحة مغلقة
// ════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config — نفس البيانات من config.js
// لازم تكررها هنا لأن SW ملف منفصل
const firebaseConfig = {
  apiKey:            "AIzaSyAvCsvFIHEBTCSTTvkcdkfQvHdtfgqxQrw",
  authDomain:        "amwaj-delivery-8239f.firebaseapp.com",
  databaseURL:       "https://amwaj-delivery-8239f-default-rtdb.firebaseio.com",
  projectId:         "amwaj-delivery-8239f",
  storageBucket:     "amwaj-delivery-8239f.firebasestorage.app",
  messagingSenderId: "130809693895",
  appId:             "1:130809693895:web:b9aa7a2468751cf5f060e2"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// إشعار في الخلفية (الصفحة مغلقة)
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '🛵 أمواج', {
    body:  body  || 'وصل طلب جديد',
    icon:  icon  || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'amwaj-notif',
    renotify: true,
    data: payload.data || {}
  });
});

// لما يضغط على الإشعار يفتح الصفحة
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      if(list.length) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});

// Cache للـ PWA (يشتغل offline)
const CACHE = 'amwaj-v1';
const CACHE_FILES = ['/', '/driver.html', '/admin.html', '/super.html', '/config.js', '/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CACHE_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
