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
 * TicketUpdated, OrderStatusChanged, RoomStatusChanged and CatalogChanged
 * to query invalidations — plus the chime and toast for a new order — so
 * the floor, the pending queue, the rooms, the open ticket screens and the
 * item pad stay live.
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

    // A live event has to refresh a list even when the cashier is not looking
    // at it — most of a shift is spent on the sale pad or inside a ticket, not
    // on the floor, so the pending-orders and rooms lists are usually
    // off-screen when their event arrives. invalidateQueries only *refetches*
    // queries that have a mounted observer (refetchType defaults to 'active');
    // an off-screen list would be marked stale but not refreshed, and could
    // stay a step behind until the screen was reopened. refetchType: 'all'
    // refreshes the cached list too, so it is already current the moment the
    // floor is shown. The refetch still carries X-Branch-Id, so it stays
    // branch-scoped.
    const refresh = (...ids: string[]) => {
      for (const id of ids) {
        queryClient.invalidateQueries({
          queryKey: [{ _id: id }],
          refetchType: 'all',
        })
      }
    }

    const invalidateTickets = () =>
      // The sale pad polls the order → ticket lookup while the confirmation
      // event is in flight; the signal short-circuits its 600ms wait. A
      // guest paying the bill online nudges it too, so the bill's online
      // payments come along.
      refresh('getOpenTickets', 'getTicket', 'getTicketByOrder', 'listOnlinePayments')

    // Broadcast to the whole admin group; the branch filter lives in the
    // query layer (the refetch carries X-Branch-Id), so a blanket
    // invalidation is always safe.
    connection.on('TicketUpdated', () => {
      invalidateTickets()
    })

    const invalidateOrders = () => refresh('getPendingOrders', 'getOrder')

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
            : translate('newOrderToast', { orderId }),
        )
      }
      if (event?.type === 'order_reminder') {
        const reminderCount = event.reminderCount ?? 1
        playAlertSound(reminderCount >= 3 ? 3 : 1)
        toast.warning(
          translate('orderWaitingToast', {
            orderId: event.orderId ?? 0,
            minutes: event.minutesPending ?? 0,
          }),
        )
      }
    })

    const invalidatePlaces = () =>
      refresh('listPlaces', 'getOpenStays', 'getOpenReservations', 'getStay')

    // Sessions start, end and get cancelled from the till, the admin apps
    // and the customers' phones alike; the rooms group carries all of it
    connection.on('RoomStatusChanged', () => {
      invalidatePlaces()
    })

    const invalidateItems = () => refresh('listItems')

    // An item marked sold out (or back) on another till or in the back
    // office; the refetch carries X-Branch-Id, so the pad shows this
    // branch's menu
    connection.on('CatalogChanged', () => {
      invalidateItems()
    })

    // A customer in a room asked for something — call a waiter, the bill,
    // a controller. Same alert a new order gets: chime + toast, and refetch
    // the floor's requests strip.
    connection.on('ServiceRequestCreated', () => {
      refresh('serviceRequestsPending')
      playAlertSound()
      toast.info(translate('newServiceRequestToast'))
    })
    // Picked up, finished, or taken back by the customer — on another till
    // or from their phone. Quiet: only the strip changes.
    connection.on('ServiceRequestChanged', () => {
      refresh('serviceRequestsPending')
    })

    const invalidateBranches = () => refresh('getBranches')

    // Opening or closing the shift (and the header pause toggles) flip the
    // branch's taking-orders / taking-reservations flags in Tenant.API; the
    // header toggles read them off the branch list
    connection.on('BranchSettingsChanged', () => {
      invalidateBranches()
    })

    const joinGroup = () =>
      Promise.all([
        connection.invoke('JoinAdminGroup'),
        connection.invoke('JoinRoomsGroup'),
      ]).catch((error) =>
        console.warn('[signalr] joining the staff groups failed:', error),
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
      invalidatePlaces()
      invalidateItems()
      invalidateBranches()
      refresh('serviceRequestsPending')
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
