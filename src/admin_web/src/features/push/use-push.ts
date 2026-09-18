import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { useLanguage } from '@/lib/i18n'
import { ensurePushToken, pushConfigured } from '@/lib/push'

// Remembered per browser: this device opted in. The subscription itself
// lives in Notification.API, keyed on the user; the flag only says whether
// to refresh it on the next load.
const KEY = 'chillax-admin-push'
const optedIn = {
  get(): boolean {
    try {
      return localStorage.getItem(KEY) === 'on'
    } catch {
      return false
    }
  },
  set(on: boolean) {
    try {
      if (on) localStorage.setItem(KEY, 'on')
      else localStorage.removeItem(KEY)
    } catch {
      // Private mode or blocked storage: the device just asks again next time
    }
  },
}

// Notification.API's admin device list: the same subscription the mobile
// admin app used, so new orders, requests and the day's digest when the
// till closes all reach this browser. No branch: the owner hears about
// every branch. An upsert, so calling it again refreshes token and language.
async function subscribe(token: string, language: string) {
  await apiClient.post('/api/notifications/subscriptions/admin-orders', {
    fcmToken: token,
    preferredLanguage: language,
    branchId: null,
  })
}

async function unsubscribe() {
  await apiClient
    .delete('/api/notifications/subscriptions/admin-orders')
    .catch(() => {})
}

/** The push toggle: whether it can be offered here, whether the browser has blocked it, and the switch. */
export function usePush() {
  const language = useLanguage((s) => s.language)
  const [enabled, setEnabled] = useState(optedIn.get)
  const available = pushConfigured() && typeof Notification !== 'undefined'
  const blocked = available && Notification.permission === 'denied'

  const toggle = useCallback(async () => {
    if (enabled) {
      optedIn.set(false)
      setEnabled(false)
      await unsubscribe()
      return
    }
    const token = await ensurePushToken(true)
    if (!token) return
    await subscribe(token, language)
    optedIn.set(true)
    setEnabled(true)
  }, [enabled, language])

  return { available, blocked, enabled, toggle }
}

/** On every load of a device that opted in: the token may have rotated and the language may have changed. */
export function useRefreshPush() {
  const language = useLanguage((s) => s.language)
  useEffect(() => {
    if (!optedIn.get() || !pushConfigured()) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    void ensurePushToken(false)
      .then((token) => (token ? subscribe(token, language) : undefined))
      .catch(() => {})
  }, [language])
}
