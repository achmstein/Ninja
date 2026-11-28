import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getStoredUser } from '@/config/oidc-config'
import { getBranchesQueryKey } from '@ninja/api/tenant/@tanstack/react-query.gen'
import type { BranchResponse } from '@ninja/api/tenant/types.gen'
import { useStaffHub } from '@ninja/web-core/hub'
import { playAlertSound } from '@ninja/web-core/sound'
import { getActiveBranchId } from '@/stores/branch-store'
import { noteOpenBills } from '@/stores/fresh-bills'
import { translate, useLanguage } from '@/lib/i18n'
import { isOwnOrder } from '@/lib/own-orders'
import { toast } from '@/lib/toast'

/** A phone delivery another branch's till took and sent to one of the business's branches */
type OrderSentToBranchEvent = {
  orderId?: number
  branchId?: number
  fromBranchId?: number
  takenBy?: string | null
}

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
  reminderCount?: number
  minutesPending?: number
  branchId?: number
  /** Where the order came from: Customer, Guest, Pos, Talabat. Absent from an older stack */
  source?: string | null
  /** The cashier who rang it up, for an order made at a till */
  takenBy?: string | null
}

/** A branch by name, in the till's language, off the cached branch list; its number when the list lacks it */
function sentFromBranchName(queryClient: QueryClient, branchId: number | undefined): string {
  const branches = queryClient.getQueryData<BranchResponse[]>(getBranchesQueryKey()) ?? []
  const name = branches.find((b) => Number(b.id) === branchId)?.name
  const text = useLanguage.getState().language === 'ar' ? name?.ar || name?.en : name?.en || name?.ar
  return text || (branchId != null ? `⁨#${branchId}⁩` : '')
}

// Order events go to every staff connection, but the pending queue is
// branch-scoped — ringing about an order this till can never show only
// confuses the cashier. Events without a branchId (older backend) alert
// everyone.
function isForActiveBranch(event: OrderStatusChangedEvent): boolean {
  return event.branchId == null || event.branchId === getActiveBranchId()
}

// The sale pad polls the order → ticket lookup while the confirmation event is in
// flight; the signal short-circuits its 600ms wait. A guest paying the bill online
// nudges it too, so the bill's online payments come along.
const TICKETS = ['getOpenTickets', 'getTicket', 'getTicketByOrder', 'listOnlinePayments']
const ORDERS = ['getPendingOrders', 'getOrder', 'getDeliveries']
const PLACES = ['listPlaces', 'getOpenStays', 'getOpenReservations', 'getStay']
// An item marked sold out (or back) on another till or in the back office
const ITEMS = ['listItems']
// Opening or closing the shift (and the header pause toggles) flip the branch's
// taking-orders / taking-reservations flags, which the header reads off the list
const BRANCHES = ['getBranches']
const REQUESTS = ['serviceRequestsPending']

/**
 * The till's live updates (mounted in the signed-in layout): the floor, the
 * pending queue, the rooms, the open bills, the item pad and the riders stay live,
 * with the chime and toast for what waits for a tap. Queries also keep a 20s poll
 * (the ticket queries' refetchInterval), so a silently dead connection can only
 * delay an update, not lose it.
 */
export function usePosNotifications() {
  const queryClient = useQueryClient()

  useStaffHub({
    getToken: () => getStoredUser()?.access_token,
    groups: ['JoinAdminGroup', 'JoinRoomsGroup'],
    refreshes: {
      TicketUpdated: TICKETS,
      OrderStatusChanged: ORDERS,
      OrderSentToBranch: ['getDeliveries', 'getOpenTickets'],
      // A delivery given to a rider, out of the door, delivered, its cash in
      DeliveryChanged: ['getDeliveries', 'getRiders', 'getOrder'],
      // A rider went on duty or off: the rider picker follows at once
      RiderStatusChanged: ['getRiders'],
      // Sessions start, end and get cancelled from the till, the admin apps and
      // the customers' phones alike; the rooms group carries all of it
      RoomStatusChanged: PLACES,
      CatalogChanged: ITEMS,
      ServiceRequestCreated: REQUESTS,
      // Picked up, finished, or taken back by the customer: only the strip changes
      ServiceRequestChanged: REQUESTS,
      BranchSettingsChanged: BRANCHES,
    },
    catchUp: [...TICKETS, ...ORDERS, ...PLACES, ...ITEMS, ...BRANCHES, ...REQUESTS],
    on: {
      // Customer app orders wait for a cashier's tap, so the till gets the alerts the
      // admin board gets: a chime and a toast when one arrives, and the backend's
      // escalating reminders for anything left waiting (1/2/4/7/10 min) — from the
      // third one on, ring rather than politely ping.
      OrderStatusChanged: (event: OrderStatusChangedEvent) => {
        if (!isForActiveBranch(event)) return
        if (event?.type === 'order_submitted') {
          const orderId = event.orderId ?? 0
          // The till that rang it up says nothing: its cashier just did it, and the
          // floor shows it land. Every other till at the branch is told
          void isOwnOrder(orderId).then((own) => {
            if (own) return
            // An order rung up at another till needs nothing from this one: a
            // quiet line saying who took it. The chime is kept for what waits for a tap
            if (event.source === 'Pos') {
              toast.info(
                event.takenBy
                  ? translate('tillOrderToastBy', { orderId, name: event.takenBy })
                  : translate('tillOrderToast', { orderId })
              )
              return
            }
            playAlertSound()
            toast.info(
              event.buyerName
                ? translate('newOrderToastFrom', { orderId, name: event.buyerName })
                : translate('newOrderToast', { orderId })
            )
          })
        }
        if (event?.type === 'order_reminder') {
          const reminderCount = event.reminderCount ?? 1
          playAlertSound(reminderCount >= 3 ? 3 : 1)
          toast.warning(
            translate('orderWaitingToast', { orderId: event.orderId ?? 0, minutes: event.minutesPending ?? 0 })
          )
        }
      },
      // A phone delivery another branch's till sent here: nobody at this till touched
      // it, so it rings like a new order and says where it came from
      OrderSentToBranch: (event: OrderSentToBranchEvent, { queryClient }) => {
        if (event?.branchId == null || event.branchId !== getActiveBranchId()) return
        playAlertSound()
        const branch = sentFromBranchName(queryClient, event.fromBranchId)
        toast.info(
          event.takenBy
            ? translate('newSentDeliveryToast', { orderId: event.orderId ?? 0, branch, name: event.takenBy })
            : translate('newSentDeliveryToastNoName', { orderId: event.orderId ?? 0, branch })
        )
      },
      // A customer in a room asked for something — call a waiter, the bill, a
      // controller. Same alert a new order gets
      ServiceRequestCreated: () => {
        playAlertSound()
        toast.info(translate('newServiceRequestToast'))
      },
    },
  })

  // Every fetch of the open bills is compared with the one before: a bill that is new, or
  // has something new on it, is marked for the floor to show landing (stores/fresh-bills.ts)
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((cacheEvent) => {
        if (cacheEvent.type !== 'updated' || cacheEvent.action.type !== 'success') return
        const key = cacheEvent.query.queryKey[0] as { _id?: string } | undefined
        if (key?._id !== 'getOpenTickets') return
        const bills = cacheEvent.query.state.data
        if (Array.isArray(bills)) noteOpenBills(bills, getActiveBranchId())
      }),
    [queryClient]
  )
}
