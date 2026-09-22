import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { subscribe, unsubscribe } from './services/notifications'
import { ensurePushToken, onForegroundMessage, pushConfigured } from './push'
import { useLanguage } from './i18n'

/**
 * Registers the signed-in customer for order/session push notifications
 * (mobile parity) and surfaces foreground pushes as query refetches.
 */
export function usePushRegistration() {
  const auth = useAuth()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!auth.isAuthenticated || !pushConfigured()) return
    let cancelled = false
    let stopForeground: (() => void) | undefined

    ;(async () => {
      const token = await ensurePushToken()
      if (cancelled || !token) return
      // Fire-and-forget; 409 (already subscribed) counts as success
      subscribe('user-orders', token, language)
      subscribe('user-sessions', token, language)

      stopForeground = await onForegroundMessage((data) => {
        const type = data?.type ?? ''
        if (type.startsWith('order')) {
          queryClient.invalidateQueries({
            queryKey: [{ _id: 'getOrdersByUser' }],
          })
          queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
        } else {
          queryClient.invalidateQueries({
            queryKey: [{ _id: 'getMyStays' }],
          })
          queryClient.invalidateQueries({
            queryKey: [{ _id: 'getMyReservations' }],
          })
          queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
          queryClient.invalidateQueries({
            queryKey: ['room-availability-subscription'],
          })
        }
      })
    })()

    return () => {
      cancelled = true
      stopForeground?.()
    }
  }, [auth.isAuthenticated, language, queryClient])
}

/** Called right before sign-out so the device stops receiving pushes. */
export async function unregisterPush(): Promise<void> {
  if (!pushConfigured()) return
  await Promise.allSettled([
    unsubscribe('user-orders'),
    unsubscribe('user-sessions'),
  ])
}
