import { useEffect } from 'react'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { getStoredUser } from '@/config/oidc-config'
import { renewSession } from '@/context/session'
import { translate } from '@/lib/i18n'
import { playAlertSound } from '@/lib/sound'
import { toast } from '@/lib/toast'
import { getActiveBranchId } from '@/stores/branch-store'

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
  branchId?: number
  isReady?: boolean
}

// Order events go to every staff connection, but the board is
// branch-scoped — ringing about an order this screen can never show only
// confuses the kitchen. Events without a branchId (older backend, and the
// confirmed event today) alert everyone.
function isForActiveBranch(event: OrderStatusChangedEvent): boolean {
  return event.branchId == null || event.branchId === getActiveBranchId()
}

/**
 * One SignalR connection for the whole kitchen session (mounted in the
 * authenticated layout). Joins the staff ("admin") group and maps every
 * OrderStatusChanged to a refetch of the board — a chime on top when an
 * order is confirmed, which is the moment it reaches the kitchen, and when
 * one is cancelled under the kitchen's hands. Another
 * screen's Ready / Bring back arrives the same way (type `order_ready`), so
 * two screens never disagree for long.
 *
 * Trimmed copy of pos_web's use-pos-notifications with the same reconnect
 * hardening (backoff start, rejoin on reconnect, restart when the tab
 * becomes visible again). The board query additionally keeps a 20s poll
 * fallback, so a silently dead connection can only ever delay an update,
 * not lose it.
 */
export function useKitchenNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hub/notifications', {
        // Asked on every (re)connection. A token that ran out (the PC slept
        // through its renewal) is renewed first: the hub would not refuse it
        // but take the page for a guest, whose group join is turned down, and
        // nothing would reach it
        accessTokenFactory: async () => {
          await renewSession().catch(() => false)
          return getStoredUser()?.access_token ?? ''
        },
      })
      .withAutomaticReconnect()
      .build()

    // Broadcast to the whole staff group; the branch filter lives in the
    // query layer (the refetch carries X-Branch-Id), so a blanket
    // invalidation is always safe. refetchType: 'all' refreshes the board even
    // when it is off-screen (the switcher or an idle tab), so a new order is
    // never a step behind — invalidateQueries otherwise only refetches a query
    // that has a mounted observer.
    const refresh = (id: string) =>
      queryClient.invalidateQueries({
        queryKey: [{ _id: id }],
        refetchType: 'all',
      })

    const invalidateBoard = () => refresh('getKitchenOrders')

    connection.on('OrderStatusChanged', (event: OrderStatusChangedEvent) => {
      invalidateBoard()
      if (!isForActiveBranch(event)) return
      if (event?.type === 'order_confirmed') {
        const orderId = event.orderId ?? 0
        playAlertSound()
        toast.info(
          event.buyerName
            ? translate('newOrderToastFrom', {
                orderId,
                name: event.buyerName,
              })
            : translate('newOrderToast', { orderId })
        )
      }
      // Its bill was voided at the till: the card turns red and stays until
      // it is cleared, and the kitchen is rung, since nobody looks at a card
      // they have already read
      if (event?.type === 'order_voided') {
        playAlertSound()
        toast.error(translate('orderCancelledToast', { orderId: event.orderId ?? 0 }))
      }
    })

    const invalidateBranches = () => refresh('getBranches')

    // The branch switcher reads names off the branch list
    connection.on('BranchSettingsChanged', () => {
      invalidateBranches()
    })

    const joinGroup = () =>
      connection
        .invoke('JoinAdminGroup')
        .catch((error) =>
          console.warn('[signalr] joining the staff group failed:', error)
        )

    let disposed = false
    // What a dropped connection may have missed, asked again
    const catchUp = () => {
      invalidateBoard()
      invalidateBranches()
    }

    let connectedBefore = false
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroup()
        // A connection opened afresh after one was lost missed what was sent
        // in between, just as a reconnected one did
        if (connectedBefore) catchUp()
        connectedBefore = true
      } catch (error) {
        console.warn('[signalr] connect failed:', error)
        // Back-off retry (backend still booting, transient network); the
        // visibility handler below also retries, and the board keeps its
        // fallback poll.
        if (
          !disposed &&
          connection.state === HubConnectionState.Disconnected
        ) {
          // Never giving up while the page is open: a till left on all day
          // must come back by itself when the network does
          setTimeout(() => start(attempt + 1), Math.min(5_000 * (attempt + 1), 30_000))
        }
      }
    }

    start()

    connection.onreconnected(() => {
      // New connection id: the group must be rejoined, and anything missed
      // while offline refetched.
      joinGroup().catch(() => {})
      catchUp()
    })

    // Automatic reconnect gave up (the network or the PC out for minutes).
    // The page may stay in front all day, so no tab change will come to
    // reopen it: try again shortly, and keep trying while it is open
    connection.onclose(() => {
      if (disposed) return
      setTimeout(() => {
        if (!disposed && connection.state === HubConnectionState.Disconnected) start()
      }, 30_000)
    })

    // Automatic reconnect gives up after long background periods; reconnect
    // when the tab becomes visible again (hard-learned on the mobile apps).
    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        connection.state === HubConnectionState.Disconnected
      ) {
        start()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibility)
      connection.stop().catch(() => {})
    }
  }, [queryClient])
}
