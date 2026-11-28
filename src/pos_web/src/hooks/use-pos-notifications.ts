import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getStoredUser } from '@/config/oidc-config'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { getBranchesQueryKey } from '@ninja/api/tenant/@tanstack/react-query.gen'
import type { BranchResponse } from '@ninja/api/tenant/types.gen'
import { renewSession } from '@ninja/web-core/session'
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

    const invalidateOrders = () => refresh('getPendingOrders', 'getOrder', 'getDeliveries')

    // Customer app orders wait for a cashier's tap, so the till gets the
    // alerts the admin board gets: a chime and a toast when one arrives, and
    // the backend's escalating reminders for anything left waiting (1/2/4/7/
    // 10 min) — from the third one on, ring rather than politely ping.
    connection.on('OrderStatusChanged', (event: OrderStatusChangedEvent) => {
      invalidateOrders()
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
              ? translate('newOrderToastFrom', {
                  orderId,
                  name: event.buyerName,
                })
              : translate('newOrderToast', { orderId })
          )
        })
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

    // A phone delivery another branch's till sent here: nobody at this till
    // touched it, so it rings like a new order and says where it came from.
    // Branch names off the branch list the switcher already holds
    connection.on('OrderSentToBranch', (event: OrderSentToBranchEvent) => {
      refresh('getDeliveries', 'getOpenTickets')
      if (event?.branchId == null || event.branchId !== getActiveBranchId()) return
      playAlertSound()
      const branch = sentFromBranchName(queryClient, event.fromBranchId)
      toast.info(
        event.takenBy
          ? translate('newSentDeliveryToast', { orderId: event.orderId ?? 0, branch, name: event.takenBy })
          : translate('newSentDeliveryToastNoName', { orderId: event.orderId ?? 0, branch })
      )
    })

    // A delivery given to a rider, out of the door, delivered, its cash in:
    // the floor's deliveries and the riders' load follow
    connection.on('DeliveryChanged', () => {
      refresh('getDeliveries', 'getRiders', 'getOrder')
    })

    // A rider went on duty or off: the rider picker follows at once
    connection.on('RiderStatusChanged', () => {
      refresh('getRiders')
    })

    const invalidatePlaces = () => refresh('listPlaces', 'getOpenStays', 'getOpenReservations', 'getStay')

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

    // Every fetch of the open bills is compared with the one before: a bill that is new, or
    // has something new on it, is marked for the floor to show landing (stores/fresh-bills.ts)
    const stopWatchingBills = queryClient.getQueryCache().subscribe((cacheEvent) => {
      if (cacheEvent.type !== 'updated' || cacheEvent.action.type !== 'success') return
      const key = cacheEvent.query.queryKey[0] as { _id?: string } | undefined
      if (key?._id !== 'getOpenTickets') return
      const bills = cacheEvent.query.state.data
      if (Array.isArray(bills)) noteOpenBills(bills, getActiveBranchId())
    })

    const joinGroup = () =>
      Promise.all([connection.invoke('JoinAdminGroup'), connection.invoke('JoinRoomsGroup')]).catch((error) =>
        console.warn('[signalr] joining the staff groups failed:', error)
      )

    let disposed = false
    // What a dropped connection may have missed, asked again
    const catchUp = () => {
      invalidateTickets()
      invalidateOrders()
      invalidatePlaces()
      invalidateItems()
      invalidateBranches()
      refresh('serviceRequestsPending')
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
        // visibility handler below also retries, and queries keep their
        // fallback poll.
        if (!disposed && connection.state === HubConnectionState.Disconnected) {
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
      if (document.visibilityState === 'visible' && connection.state === HubConnectionState.Disconnected) {
        start()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      disposed = true
      stopWatchingBills()
      document.removeEventListener('visibilitychange', handleVisibility)
      connection.stop().catch(() => {})
    }
  }, [queryClient])
}
