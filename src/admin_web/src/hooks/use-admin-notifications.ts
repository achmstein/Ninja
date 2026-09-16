import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getStoredUser } from '@/config/oidc-config'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { getActiveBranchId } from '@/stores/branch-store'
import { translate, useLanguage } from '@/lib/i18n'
import { playAlertSound } from '@/lib/sound'
import { toast } from '@/lib/toast'
import { unitLabel } from '@/features/inventory/format'

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
  reminderCount?: number
  minutesPending?: number
  branchId?: number
}

type StockLowEvent = {
  branchId?: number
  stockItemId?: number
  name?: { en?: string | null; ar?: string | null } | null
  unit?: string
  onHand?: number | string
  reorderLevel?: number | string
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
 * authenticated layout). Joins the admin and rooms hub groups and maps hub events
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

    // A live event has to refresh a list even when it is off-screen (the admin
    // is on a different page when the order lands). invalidateQueries only
    // refetches a query with a mounted observer (refetchType defaults to
    // 'active'), so refetchType: 'all' refreshes the cached list too — it is
    // then already current the moment that page is opened. The refetch carries
    // X-Branch-Id, so it stays branch-scoped.
    const refresh = (...ids: string[]) => {
      for (const id of ids) {
        queryClient.invalidateQueries({
          queryKey: [{ _id: id }],
          refetchType: 'all',
        })
      }
    }

    const invalidateOrders = () =>
      refresh('getAllOrders', 'getPendingOrders', 'getOrder')

    const invalidatePlaces = () =>
      refresh(
        'listPlaces',
        'getOpenStays',
        'getStay',
        'getStayHistory',
        'getPlaceStayHistory'
      )

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
      invalidatePlaces()
    })

    // Inventory.API raises this when a movement takes an item to or below
    // its reorder level at a branch. Every branch's levels are refreshed;
    // only the active branch's warning is worth a toast.
    connection.on('StockLow', (event: StockLowEvent) => {
      refresh('getStockLevels')
      if (event.branchId == null || event.branchId !== getActiveBranchId()) {
        return
      }
      const language = useLanguage.getState().language
      const name =
        (language === 'ar' ? event.name?.ar : event.name?.en) ||
        event.name?.en ||
        event.name?.ar ||
        ''
      toast.warning(
        translate('stockLowToast', {
          name,
          onHand: Number(event.onHand ?? 0),
          unit: unitLabel(event.unit, translate),
        })
      )
    })

    connection.on('ServiceRequestCreated', (event: { branchId?: number }) => {
      queryClient.invalidateQueries({
        queryKey: ['service-requests'],
        refetchType: 'all',
      })
      // A waiter call is as urgent as a new order: same chime, same branch scope
      if (!isForActiveBranch(event)) return
      playAlertSound()
      toast.info(translate('newServiceRequest'))
    })

    // Joins are independent so one failing (e.g. a policy rejection) can't
    // silently kill the other, and every failure is named in the console —
    // a dead connection here is otherwise invisible.
    const joinGroups = () =>
      Promise.allSettled([
        connection.invoke('JoinAdminGroup').catch((error) =>
          // eslint-disable-next-line no-console
          console.warn('[signalr] JoinAdminGroup failed:', error)
        ),
        connection.invoke('JoinRoomsGroup').catch((error) =>
          // eslint-disable-next-line no-console
          console.warn('[signalr] JoinRoomsGroup failed:', error)
        ),
      ])

    let disposed = false
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroups()
      } catch (error) {
        // eslint-disable-next-line no-console
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
      invalidatePlaces()
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
