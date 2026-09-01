import { useEffect } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { translate } from '@/lib/i18n'
import { playAlertSound } from '@/lib/sound'
import { toast } from '@/lib/toast'
import { getActiveBranchId } from '@/stores/branch-store'
import { getStoredUser } from '@/config/oidc-config'

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
  reminderCount?: number
  minutesPending?: number
  branchId?: number
}

// Admin SignalR events are broadcast to every admin, but the orders board is
// branch-scoped — alerting about an order this dashboard can never display
// only confuses the operator (same filtering the FCM pushes already do).
// Events without a branchId (older backend) alert everyone.
function isForActiveBranch(event: OrderStatusChangedEvent): boolean {
  return event.branchId == null || event.branchId === getActiveBranchId()
}

/**
 * One SignalR connection for the whole admin session (mounted in the
 * authenticated layout). Joins the admin and rooms groups and maps hub events
 * to query invalidations and toasts, so lists stay live without polling.
 */
export function useAdminNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hub/notifications', {
        accessTokenFactory: () => getStoredUser()?.access_token ?? '',
      })
      .withAutomaticReconnect()
      .build()

    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllOrders' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getPendingOrders' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
    }

    const invalidateRooms = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getActiveSessions' }],
      })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getSessionHistory' }],
      })
    }

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
      // The backend escalates reminders for unconfirmed orders (1/2/4/7/10
      // min — same pushes that make the admin phones ring); from the third
      // one on, ring the chime instead of politely pinging once
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

    connection.on('RoomStatusChanged', () => {
      invalidateRooms()
    })

    connection.on('ServiceRequestCreated', () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] })
      toast.info(translate('newServiceRequest'))
    })

    // Joins are independent so one failing (e.g. a policy rejection) can't
    // silently kill the other, and every failure is named in the console —
    // a dead connection here is otherwise invisible.
    const joinGroups = () =>
      Promise.allSettled([
        connection
          .invoke('JoinAdminGroup')
          .catch((error) =>
            console.warn('[signalr] JoinAdminGroup failed:', error)
          ),
        connection
          .invoke('JoinRoomsGroup')
          .catch((error) =>
            console.warn('[signalr] JoinRoomsGroup failed:', error)
          ),
      ])

    let disposed = false
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroups()
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
      // New connection id: groups must be rejoined, and anything missed
      // while offline refetched.
      joinGroups().catch(() => {})
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
