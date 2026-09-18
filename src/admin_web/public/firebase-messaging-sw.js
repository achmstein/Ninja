/* global importScripts, firebase, clients */
// Firebase Cloud Messaging service worker for the back office. The app
// registers it with the Firebase config in the query string (the config is
// public by design), so this file needs no build-time templating.
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
  const title = payload.notification?.title ?? 'Chillax'
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? '',
    icon: '/icons/icon-192.png',
    data: payload.data ?? {},
  })
})

// Tap routing: the page that owns what the push is about
function targetFor(type) {
  if (type === 'shift_closed') return '/till'
  if (type.startsWith('order') || type === 'new_order') return '/orders'
  if (type.includes('request')) return '/requests'
  if (type.includes('reservation') || type.includes('session')) return '/places'
  return '/'
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = targetFor(event.notification.data?.type ?? '')
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
