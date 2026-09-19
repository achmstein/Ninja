/* global importScripts, firebase, clients */
// Firebase Cloud Messaging service worker. The web app registers it with the
// Firebase config in the query string (the config is public by design), so
// this file needs no build-time templating.
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js'
)
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'
)

const params = new URL(self.location).searchParams
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

const messaging = firebase.messaging()

// Background pushes: show the localized notification the server composed
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Ninja'
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? '',
    icon: '/api/tenant/icons/icon-192.png',
    data: payload.data ?? {},
  })
})

// Tap routing, mirroring the mobile app's deep links
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const type = event.notification.data?.type ?? ''
  const target = ['order_confirmed', 'order_cancelled'].includes(type)
    ? '/orders'
    : '/places'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ('focus' in client) {
            client.navigate(target)
            return client.focus()
          }
        }
        return clients.openWindow(target)
      })
  )
})
