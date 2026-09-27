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

/* 🧭 إشعارات الإدارة (طلب جديد، تسجيل، دردشة…) أحياناً توصل لهذا الملف
   مو لـadmin-sw.js — الموقع واللوحة على نفس الدومين، وأي واحد تفتحه
   آخر شي بنفس المتصفح ياخذ مكان الثاني. فلازم هذا الملف هم يعرف
   يوديها للوحة، مو لصفحة الموقع. */
const ADMIN_PAGE_OF = {
  admin_new_customer:    'cust',
  admin_new_order:       'ord',
  admin_order_cancelled: 'ord',
  admin_chat:            'chat',
};
function isAdminType(t) { return String(t || '').indexOf('admin_') === 0; }

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
  
  /* ⚠️ إشعارات المواقع بالآيفون: النظام نفسه يضيف سطر «from امواج للالكترونيات»
     تحت العنوان — فما نكرر اسم المحل بالعنوان (كان يطلع مرتين). العنوان = الحدث. */
  const evTitle = notif.title || data._title || '';
  const evBody  = notif.body  || data._body  || 'إشعار جديد';
  const title = evTitle || 'امواج للالكترونيات';
  const body  = evBody;
  
  // 💾 احفظ للـ notification center
  const notifData = {
    title: evTitle || title,     // مركز الإشعارات بالموقع يحفظ الحدث نفسه
    body: evBody,
    type: data.type || 'general',
    orderId: data.orderId || '',
    target: data.target || '',
    url: data.url || ''
  };
  
  const forAdmin = isAdminType(data.type);
  const options = {
    body: body,
    icon: forAdmin ? '/pwa-192.png' : 'https://www.amwajmob.com/icon-192.png',
    badge: forAdmin ? '/pwa-192.png' : 'https://www.amwajmob.com/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    // نفس وسم اللوحة — لو وصل من الطريقين، الثاني يبدّل الأول بدل ما يتكرر
    tag: forAdmin ? 'amwaj-' + (ADMIN_PAGE_OF[data.type] || 'ord') : 'amwaj_' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: data,
    vibrate: [300, 100, 300, 100, 300],
    silent: false,
    timestamp: Date.now(),
    actions: forAdmin ? [] : [
      { action: 'open', title: '📱 افتح التطبيق' }
    ]
  };
  
  console.log('[SW] Showing notification:', title, options);
  
  // احفظ في IndexedDB بالتوازي مع عرض الإشعار
  return Promise.all([
    self.registration.showNotification(title, options),
    // 💬 رد الدردشة: المحادثة نفسها هي السجل — ما نكرره بمركز الإشعارات
    // 🧑‍💼 إشعار إدارة: مو من إشعارات الزبون، فما ينحفظ بمركزه
    (data.type === 'chat' || forAdmin) ? Promise.resolve() : saveNotifToDB(notifData)
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
  
  // 🧑‍💼 إشعار إدارة → لوحة التحكم على الصفحة الصحيحة (مو الموقع)
  if (isAdminType(type)) {
    const page = ADMIN_PAGE_OF[type] || 'ord';
    event.waitUntil(
      clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list) {
        for (const c of list) {
          if (c.url.indexOf('/admin.html') !== -1 && 'focus' in c) {
            c.postMessage({ amwaj: 'open', page: page, phone: data.phone || '' });
            return c.focus();
          }
        }
        return clients.openWindow('/admin.html#' + page +
          (page === 'chat' && data.phone ? ':' + encodeURIComponent(data.phone) : ''));
      })
    );
    return;
  }

  /* 📍 وإلا افتح المتجر مع بارامترات التوجيه الداخلي.
     ⚠️ مو «/» — هذيك صفحة التعريف (الواجهة)، مو المتجر. كانت
     كل ضغطة إشعار والموقع مسكّر تودّي الزبون لها. */
  const params = [];
  if (type) params.push('notif_type=' + encodeURIComponent(type));
  if (orderId) params.push('notif_orderId=' + encodeURIComponent(orderId));
  if (target) params.push('notif_target=' + encodeURIComponent(target));
  const targetUrl = '/activate.html' + (params.length ? '?' + params.join('&') : '');

  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // صفحة المتجر المفتوحة — مو اللوحة ولا صفحة التعريف
        if (client.url.indexOf('/activate.html') !== -1 && 'focus' in client) {
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
