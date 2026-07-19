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

// 💾 احفظ الإشعار في IndexedDB عشان الموقع يقدر يجيبه لمركز الإشعارات
function saveNotifToDB(notif) {
  return new Promise(function(resolve){
    try {
      var openReq = indexedDB.open('amwaj_notifs_db', 1);
      openReq.onupgradeneeded = function(e){
        var db = e.target.result;
        if (!db.objectStoreNames.contains('pending')) {
          db.createObjectStore('pending', { keyPath: 'id' });
        }
      };
      openReq.onsuccess = function(){
        var db = openReq.result;
        var tx = db.transaction('pending', 'readwrite');
        var store = tx.objectStore('pending');
        var id = 'sw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        store.add({
          id: id,
          title: notif.title || '',
          body: notif.body || '',
          type: notif.type || 'general',
          orderId: notif.orderId || '',
          target: notif.target || '',
          url: notif.url || '',
          timestamp: Date.now()
        });
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ resolve(); };
      };
      openReq.onerror = function(){ resolve(); };
    } catch(e){ console.error('[SW] saveNotifToDB error:', e); resolve(); }
  });
}

// استقبال الإشعارات لما الموقع مغلق
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);
  
  const data = payload.data || {};
  const notif = payload.notification || {};
  
  const title = notif.title || data._title || 'أمواج للإلكترونيات';
  const body  = notif.body  || data._body  || 'إشعار جديد';
  
  // 💾 احفظ للـ notification center
  const notifData = {
    title: title,
    body: body,
    type: data.type || 'general',
    orderId: data.orderId || '',
    target: data.target || '',
    url: data.url || ''
  };
  
  const options = {
    body: body,
    icon: 'https://www.amwajmob.com/icon-192.png',
    badge: 'https://www.amwajmob.com/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'amwaj_' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: data,
    vibrate: [300, 100, 300, 100, 300],
    silent: false,
    timestamp: Date.now(),
    actions: [
      { action: 'open', title: '📱 افتح التطبيق' }
    ]
  };
  
  console.log('[SW] Showing notification:', title, options);
  
  // احفظ في IndexedDB بالتوازي مع عرض الإشعار
  return Promise.all([
    self.registration.showNotification(title, options),
    saveNotifToDB(notifData)
  ]).then(function(){
    console.log('[SW] ✅ Notification shown + saved to DB');
  }).catch(function(err){
    console.error('[SW] ❌ Error:', err);
  });
});

// لما المستخدم يضغط على الإشعار
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();
  
  const data = event.notification.data || {};
  const type = data.type || 'general';
  const orderId = data.orderId || '';
  const target = data.target || '';
  const externalUrl = data.url || '';
  
  // 🔗 لو الإشعار فيه رابط خارجي (مثل Play Store) → افتح الرابط مباشرة
  if (externalUrl) {
    event.waitUntil(
      clients.openWindow(externalUrl).then(function(){
        console.log('[SW] Opened external URL:', externalUrl);
      }).catch(function(err){
        console.error('[SW] Failed to open URL:', err);
      })
    );
    return;
  }
  
  // 📍 وإلا افتح الموقع مع بارامترات التوجيه الداخلي
  let targetUrl = '/';
  const params = [];
  if (type) params.push('notif_type=' + encodeURIComponent(type));
  if (orderId) params.push('notif_orderId=' + encodeURIComponent(orderId));
  if (target) params.push('notif_target=' + encodeURIComponent(target));
  if (params.length) targetUrl = '/?' + params.join('&');
  
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
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
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('error', function(e) {
  console.error('[SW] Error:', e);
});
