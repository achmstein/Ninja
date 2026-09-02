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
  reminderCount?: number
  minutesPending?: number
  branchId?: number
}

// Order events go to every staff connection, but the pending queue is
// branch-scoped — ringing about an order this till can never show only
// confuses the cashier. Events without a branchId (older backend) alert
// everyone.
function isForActiveBranch(event: OrderStatusChangedEvent): boolean {
  return event.branchId == null || event.branchId === getActiveBranchId()
}

/**
 * One SignalR connection for the whole POS session (mounted in the
 * authenticated layout). Joins the admin and rooms groups and maps
 * TicketUpdated, OrderStatusChanged and RoomStatusChanged to query
 * invalidations — plus the chime and toast for a new order — so the floor,
 * the pending queue, the rooms and the open ticket screens stay live.
 *
 * Trimmed copy of admin_web's use-admin-notifications with the same
 * reconnect hardening (backoff start, rejoin on reconnect, restart when the
 * tab becomes visible again). Queries additionally keep a 20s poll fallback
 * (see the refetchInterval on the ticket queries), so a silently dead
 * connection can only ever delay an update, not lose it.
 */
export function usePosNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hub/notifications', {
        accessTokenFactory: () => getStoredUser()?.access_token ?? '',
      })
      .withAutomaticReconnect()
      .build()

    const invalidateTickets = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      // The sale pad polls the order → ticket lookup while the confirmation
      // event is in flight; the signal short-circuits its 600ms wait
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getTicketByOrder' }],
      })
    }

    // Broadcast to the whole admin group; the branch filter lives in the
    // query layer (the refetch carries X-Branch-Id), so a blanket
    // invalidation is always safe.
    connection.on('TicketUpdated', () => {
      invalidateTickets()
    })

    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getPendingOrders' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
    }

    // Customer app orders wait for a cashier's tap, so the till gets the
    // alerts the admin board gets: a chime and a toast when one arrives, and
    // the backend's escalating reminders for anything left waiting (1/2/4/7/
    // 10 min) — from the third one on, ring rather than politely ping.
    connection.on('OrderStatusChanged', (event: OrderStatusChangedEvent) => {
      invalidateOrders()
      if (!isForActiveBranch(event)) return
      if (event?.type === 'order_submitted') {
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
      if (event?.type === 'order_reminder') {
        const reminderCount = event.reminderCount ?? 1
        playAlertSound(reminderCount >= 3 ? 3 : 1)
        toast.warning(
          translate('orderWaitingToast', {
            orderId: event.orderId ?? 0,
            minutes: event.minutesPending ?? 0,
          })
        )
      }
    })

    const invalidateRooms = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getActiveSessions' }] })
    }

    // Sessions start, end and get cancelled from the till, the admin apps
    // and the customers' phones alike; the rooms group carries all of it
    connection.on('RoomStatusChanged', () => {
      invalidateRooms()
    })

    const joinGroup = () =>
      Promise.all([
        connection.invoke('JoinAdminGroup'),
        connection.invoke('JoinRoomsGroup'),
      ]).catch((error) =>
        console.warn('[signalr] joining the staff groups failed:', error)
      )

    let disposed = false
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroup()
      } catch (error) {
        console.warn('[signalr] connect failed:', error)
        // Back-off retry (backend still booting, transient network); the
        // visibility handler below also retries, and queries keep their
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
      invalidateTickets()
      invalidateOrders()
      invalidateRooms()
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
