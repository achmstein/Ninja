// Web push (FCM) token plumbing. Degrades gracefully: returns null when the
// browser doesn't support push, permission is denied, or the Firebase web
// config isn't provided.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export function pushConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId && vapidKey)
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null
let cachedToken: string | null = null

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!pushConfigured() || !(await isSupported())) return null
  app ??= initializeApp(config)
  messaging ??= getMessaging(app)
  return messaging
}

/**
 * Resolves the FCM token, asking for notification permission if needed.
 * Call from a user gesture (or right after login) — never on page load.
 */
export async function ensurePushToken(
  requestPermission = true
): Promise<string | null> {
  try {
    const instance = await getMessagingInstance()
    if (!instance) return null
    if (Notification.permission === 'denied') return null
    if (Notification.permission !== 'granted') {
      if (!requestPermission) return null
      const result = await Notification.requestPermission()
      if (result !== 'granted') return null
    }
    if (cachedToken) return cachedToken
    // The SW reads the (public) Firebase config from its query string
    const swParams = new URLSearchParams({
      apiKey: config.apiKey ?? '',
      authDomain: config.authDomain ?? '',
      projectId: config.projectId ?? '',
      messagingSenderId: config.messagingSenderId ?? '',
      appId: config.appId ?? '',
    })
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${swParams}`
    )
    cachedToken = await getToken(instance, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
    return cachedToken
  } catch {
    return null
  }
}

/** Foreground messages (page visible): the caller decides how to surface them */
export async function onForegroundMessage(
  handler: (data: Record<string, string> | undefined) => void
): Promise<() => void> {
  const instance = await getMessagingInstance()
  if (!instance || Notification.permission !== 'granted') return () => {}
  return onMessage(instance, (payload) => handler(payload.data))
}
