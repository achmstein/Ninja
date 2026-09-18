import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { claimGuestOrders } from '@/api/ordering'
import { API_VERSION } from '@/lib/api-client'
import { useGuestStore } from '@/stores/guest-store'

/**
 * A guest who signs in takes their orders with them. The device still
 * holds the guest id it ordered under; once there is an account, Ordering
 * assigns every unclaimed order under that id to it (Sales and Loyalty
 * follow by event), and the guest identity is dropped so this browser
 * stops ordering as a guest. A failed claim leaves the id in place, so the
 * next load tries again.
 */
export function useClaimGuestOrders() {
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)
  const clear = useGuestStore((s) => s.clear)
  const queryClient = useQueryClient()
  const claiming = useRef(false)

  useEffect(() => {
    if (!auth.isAuthenticated || !guestId || claiming.current) return
    claiming.current = true
    claimGuestOrders({
      body: { guestId },
      query: { 'api-version': API_VERSION },
      throwOnError: true,
    })
      .then(() => {
        clear()
        void queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
        void queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyBills' }] })
      })
      .catch(() => {})
      .finally(() => {
        claiming.current = false
      })
  }, [auth.isAuthenticated, guestId, clear, queryClient])
}
