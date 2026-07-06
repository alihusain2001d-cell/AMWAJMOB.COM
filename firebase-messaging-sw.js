// ==============================================
// Firebase Messaging Service Worker - Amwaj Electronics
// يعمل هذا الملف بالخلفية لاستقبال الإشعارات
// حتى لو الموقع مغلق
// ==============================================

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAdSbo06nkTZFYFtnk3Om4Q0spiAxzy9nU',
  projectId: 'amwaj-electronics',
  messagingSenderId: '680328798771',
  appId: '1:680328798771:web:web-app'
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
  const target = data.target || '';
  
  // افتح الموقع
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
      // لو ما مفتوح، افتح تاب جديد
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
