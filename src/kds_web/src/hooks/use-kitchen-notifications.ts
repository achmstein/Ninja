import { useEffect } from 'react'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { getStoredUser } from '@/config/oidc-config'
import { translate } from '@/lib/i18n'
import { playAlertSound } from '@/lib/sound'
import { toast } from '@/lib/toast'
import { getActiveBranchId } from '@/stores/branch-store'

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
  branchId?: number
  preparation?: string
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
 * order is confirmed, which is the moment it reaches the kitchen. Another
 * screen's Start / Ready / Recall arrives the same way (type
 * `order_preparation`), so two screens never disagree for long.
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
        accessTokenFactory: () => getStoredUser()?.access_token ?? '',
      })
      .withAutomaticReconnect()
      .build()

    // Broadcast to the whole staff group; the branch filter lives in the
    // query layer (the refetch carries X-Branch-Id), so a blanket
    // invalidation is always safe.
    const invalidateBoard = () =>
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getKitchenOrders' }] })

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
    })

    const invalidateBranches = () =>
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })

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
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroup()
      } catch (error) {
        console.warn('[signalr] connect failed:', error)
        // Back-off retry (backend still booting, transient network); the
        // visibility handler below also retries, and the board keeps its
        // fallback poll.
        if (
          !disposed &&
          attempt < 5 &&
          connection.state === HubConnectionState.Disconnected
        ) {
          setTimeout(() => start(attempt + 1), 5_000 * (attempt + 1))
        }
      }
    }

    start()

    connection.onreconnected(() => {
      // New connection id: the group must be rejoined, and anything missed
      // while offline refetched.
      joinGroup().catch(() => {})
      invalidateBoard()
      invalidateBranches()
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
