import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { apiClient } from '@/lib/api-client'
import { useNetworkStatus, watchNetwork } from '@/lib/network-status'
import {
  drainOfflineSales,
  loadOfflineSales,
  useOfflineQueue,
} from './offline-queue'
import { useBranchPricing } from './use-branch-pricing'

/** While sales wait, how often the till tries them again even without a sign the server is back */
const DRAIN_RETRY_MS = 30_000

/**
 * Keeps the till's idea of the network current and sends what was sold
 * offline as soon as it can: at startup, the moment the server answers
 * again, once a renewed sign-in lands, and every half minute while anything
 * is still queued. Mount once, inside the signed-in layout.
 */
export function useOfflineSync() {
  const queryClient = useQueryClient()
  const online = useNetworkStatus((s) => s.online)
  const auth = useAuth()
  // A renewed token is a new chance: the drain waits for one the server accepts
  const token = auth.user?.access_token
  const queued = useOfflineQueue((s) =>
    s.sales.some((sale) => sale.status === 'queued'),
  )

  // Fetched while the server is there, for the sale that is rung up when it is not
  useBranchPricing()

  // The tenant document is anonymous and small: the cheapest "are you there?"
  useEffect(() => watchNetwork(() => apiClient.get('/api/tenant')), [])

  useEffect(() => {
    void loadOfflineSales()
  }, [])

  useEffect(() => {
    if (!online) return
    let cancelled = false
    const drain = () => {
      void drainOfflineSales().then((replayed) => {
        if (!replayed || cancelled) return
        // The replayed sales are bills on the floor and money in the drawer now
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      })
    }
    drain()
    const timer = queued ? setInterval(drain, DRAIN_RETRY_MS) : null
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [online, token, queued, queryClient])
}
