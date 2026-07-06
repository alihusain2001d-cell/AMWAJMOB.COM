// ==============================================
// Firebase Messaging Service Worker - Amwaj Electronics
// ==============================================

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

const messaging = firebase.messaging();

// استقبال الإشعارات لما الموقع مغلق
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message:', payload);
  
  const data = payload.data || {};
  const notif = payload.notification || {};
  
  const title = notif.title || data._title || 'أمواج للإلكترونيات';
  const body  = notif.body  || data._body  || 'إشعار جديد';
  
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.type || 'general',
    data: data,
    vibrate: [200, 100, 200],
    requireInteraction: data.type === 'admin_new_order' || data.type === 'admin_order_cancelled'
  };
  
  return self.registration.showNotification(title, options);
});

// لما المستخدم يضغط على الإشعار
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const data = event.notification.data || {};
  const type = data.type || 'general';
  const orderId = data.orderId || '';
  const target = data.target || '';
  
  // ابنِ URL مع بارامترات الإشعار (يستخدمها الموقع للتنقّل)
  let targetUrl = '/';
  const params = [];
  if (type) params.push('notif_type=' + encodeURIComponent(type));
  if (orderId) params.push('notif_orderId=' + encodeURIComponent(orderId));
  if (target) params.push('notif_target=' + encodeURIComponent(target));
  if (params.length) targetUrl = '/?' + params.join('&');
  
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      // لو الموقع مفتوح، ركز عليه وأرسل الحدث
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
          client.postMessage({
            type: 'notification-click',
            data: data
          });
          return client.focus();
        }
      }
      // لو ما مفتوح، افتح تاب جديد مع البارامترات
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
