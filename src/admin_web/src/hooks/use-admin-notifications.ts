import { useEffect } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { getStoredUser } from '@/config/oidc-config'

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
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
      if (event?.type === 'order_submitted') {
        toast.info(
          event.buyerName
            ? `New order #${event.orderId} from ${event.buyerName}`
            : `New order #${event.orderId}`
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

    const joinGroups = async () => {
      await Promise.all([
        connection.invoke('JoinAdminGroup'),
        connection.invoke('JoinRoomsGroup'),
      ])
    }

    const start = async () => {
      try {
        await connection.start()
        await joinGroups()
      } catch {
        // Initial connect failed (backend down, token expired). The
        // visibility handler below retries; queries keep their fallback poll.
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
      document.removeEventListener('visibilitychange', handleVisibility)
      connection.stop().catch(() => {})
    }
  }, [queryClient])
}
