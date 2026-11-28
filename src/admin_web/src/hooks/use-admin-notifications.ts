import { getStoredUser } from '@/config/oidc-config'
import { useStaffHub, type HubTools } from '@ninja/web-core/hub'
import { playAlertSound } from '@ninja/web-core/sound'
import { getActiveBranchId } from '@/stores/branch-store'
import { brandQueryKey, type Brand } from '@/lib/brand'
import { translate, useLanguage } from '@/lib/i18n'
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
function isForActiveBranch(event: { branchId?: number }): boolean {
  return event.branchId == null || event.branchId === getActiveBranchId()
}

const ORDERS = ['getAllOrders', 'getPendingOrders', 'getOrder']
const PLACES = [
  'listPlaces',
  'getOpenStays',
  'getOpenReservations',
  'getReservationHistory',
  'getPlaceReservationHistory',
  'getStay',
  'getStayHistory',
  'getPlaceStayHistory',
]
const RIDERS = ['getRidersOverview', 'getRiderDeliveries', 'getDeliveryTimeline']

// Service requests are cached under a hand-made key, not an operation id
const refreshServiceRequests = ({ queryClient }: HubTools) =>
  queryClient.invalidateQueries({ queryKey: ['service-requests'], refetchType: 'all' })

/**
 * The back office's live updates (mounted in the signed-in layout): hub events
 * refresh the lists they touch and ring for what needs someone, so pages stay
 * live without polling.
 */
export function useAdminNotifications() {
  useStaffHub({
    getToken: () => getStoredUser()?.access_token,
    groups: ['JoinAdminGroup', 'JoinRoomsGroup'],
    refreshes: {
      OrderStatusChanged: ORDERS,
      RoomStatusChanged: PLACES,
      RiderStatusChanged: RIDERS,
      DeliveryChanged: RIDERS,
    },
    catchUp: [...ORDERS, ...PLACES, ...RIDERS],
    on: {
      OrderStatusChanged: (event: OrderStatusChangedEvent) => {
        if (!isForActiveBranch(event)) return
        if (event?.type === 'order_submitted') {
          const orderId = event.orderId ?? 0
          playAlertSound()
          toast.info(
            event.buyerName
              ? translate('newOrderToastFrom', { orderId, name: event.buyerName })
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
            translate('orderWaitingToast', { orderId: event.orderId ?? 0, minutes: event.minutesPending ?? 0 })
          )
        }
      },
      StockLow: (event: StockLowEvent, tools) => {
        if (tools.queryClient.getQueryData<Brand>(brandQueryKey())?.features?.inventory === false) return
        tools.refresh('getStockLevels')
        if (event.branchId == null || event.branchId !== getActiveBranchId()) return
        const language = useLanguage.getState().language
        const name = (language === 'ar' ? event.name?.ar : event.name?.en) || event.name?.en || event.name?.ar || ''
        toast.warning(
          translate('stockLowToast', {
            name,
            onHand: Number(event.onHand ?? 0),
            unit: unitLabel(event.unit, translate),
          })
        )
      },
      ServiceRequestCreated: (event: { branchId?: number }, tools) => {
        void refreshServiceRequests(tools)
        if (!isForActiveBranch(event)) return
        playAlertSound()
        toast.info(translate('newServiceRequest'))
      },
      ServiceRequestChanged: (_event: unknown, tools) => void refreshServiceRequests(tools),
    },
  })
}
