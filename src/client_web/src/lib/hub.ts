import { useEffect } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  type HubConnection,
} from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getGuestId, useGuestStore } from '@/stores/guest-store'
import { getActivePlace, usePlaceStore } from '@/stores/place-store'
import { useThanksStore } from '@/stores/thanks-store'
import { getStoredUser } from './oidc'
import { translate } from './i18n'
import {
  REQUEST_STATUS,
  type ServiceRequestChangedEvent,
} from './services/notifications'
import { toast } from './toast'

// One SignalR connection for the whole app (mobile parity: single hub with
// OrderStatusChanged / RoomStatusChanged / BranchSettingsChanged /
// CatalogChanged events).
let connection: HubConnection | null = null

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  /** On order_paid: the receipt the bill was settled on */
  receiptNumber?: number | null
}

/** What PlaceCleared carries: the sitting at a place ended, and why */
type PlaceClearedEvent = {
  placeId?: number
  receiptNumber?: number | null
  reason?: 'paid' | 'voided' | 'ended'
}

/**
 * The token to open the hub with. The same test as auth.isAuthenticated and
 * the API client: an expired session left in storage is not a sign-in.
 * Sending its token would have the hub refuse the connection outright, and
 * the customer — a guest by now — would silently get no events at all.
 */
function liveAccessToken(): string | null {
  const user = getStoredUser()
  return user && !user.expired ? user.access_token : null
}

function getConnection(): HubConnection {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl('/hub/notifications', {
        accessTokenFactory: () => liveAccessToken() ?? '',
      })
      .withAutomaticReconnect()
      .build()
  }
  return connection
}

function ensureStarted(conn: HubConnection) {
  if (conn.state === HubConnectionState.Disconnected) {
    conn
      .start()
      .then(() => console.info('[hub] connected', conn.connectionId))
      // Retried by the timer in useHub; said out loud so a hub that never
      // comes up is not a silent nothing
      .catch((error) => console.warn('[hub] start failed', error))
  }
}

/**
 * The hub learns who is connected from the token sent at connect time, and
 * puts a signed-in customer in their own group right then. A connection
 * opened before sign-in completed (the app boots, then the code exchange
 * lands) is anonymous for its whole life — so it is torn down and reopened
 * whenever the signed-in user changes, sign-out included.
 */
async function restart(conn: HubConnection) {
  if (conn.state !== HubConnectionState.Disconnected) {
    await conn.stop().catch(() => {})
  }
  ensureStarted(conn)
}

/**
 * A signed-in customer is put in their own group by the hub on connect, from
 * the token. A guest has no token, so they ask to join the group named by the
 * guest id their browser holds — sent as an invocation rather than in the
 * connection URL, keeping that id out of access logs.
 *
 * Group membership does not survive a reconnect, so this re-runs whenever the
 * connection id changes, the same way the rooms group is kept.
 */
function joinGuestGroup(
  conn: HubConnection,
  onJoined: (connectionId: string, guestId: string) => void,
): void {
  if (conn.state !== HubConnectionState.Connected) return
  if (liveAccessToken()) return

  const guestId = getGuestId()
  if (!guestId) return

  const connectionId = conn.connectionId ?? ''
  conn
    .invoke('JoinGuestGroup', guestId)
    .then(() => {
      // Only a join the hub accepted counts; a failed one is tried again
      onJoined(connectionId, guestId)
      console.info('[hub] joined guest group', guestId)
    })
    .catch((error) => console.warn('[hub] guest group join failed', error))
}

/** Mounted once in the root layout: starts the hub and maps events to query
 *  invalidations. */
export function useHub() {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const userId = auth.user?.profile.sub ?? null

  // Reconnect as the user who just signed in (or as nobody, after sign-out).
  // The first run is a plain start; only a change in identity restarts.
  useEffect(() => {
    const conn = getConnection()
    if (conn.state === HubConnectionState.Disconnected) ensureStarted(conn)
    else void restart(conn)
  }, [userId])

  useEffect(() => {
    const conn = getConnection()

    // The mobile app hears about these as push notifications; on the web the
    // hub event was only refreshing lists, so a customer watching the screen
    // saw their order change state with nothing said about it.
    const onOrder = (event?: OrderStatusChangedEvent) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })

      const orderId = event?.orderId ?? 0
      if (event?.type === 'order_confirmed') {
        toast.success(translate('orderConfirmedToast', { orderId }))
      } else if (event?.type === 'order_cancelled') {
        toast.error(translate('orderCancelledToast', { orderId }))
      } else if (event?.type === 'order_paid') {
        // The bill is paid: the table card dissolves into thanks, and the
        // scanned table clears itself so the next scan starts clean
        const place = getActivePlace()
        const thanks = useThanksStore.getState()
        if (place) {
          thanks.setPaid({
            placeName: place.name,
            receiptNumber: event.receiptNumber ?? null,
            orderId: event.orderId ?? null,
          })
          usePlaceStore.getState().clearPlace()
        } else if (thanks.paid && thanks.paid.orderId == null) {
          // The table's own "cleared" beat this one to it: add the order
          // so the thanks card can ask how it was
          thanks.setPaid({ ...thanks.paid, orderId: event.orderId ?? null })
        }
      }
    }
    const onRoom = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getPlace' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'scanPlace' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getAvailablePlaces' }],
      })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
    }
    const onBranchSettings = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
    }
    // An item went sold out (or came back) at the till: every menu query
    // refetches, each carrying the branch header, so the customer sees it
    // grey out without reloading
    const onCatalog = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getItemsByType' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getAvailableItems' }],
      })
    }

    // A request of theirs moved at the till: the pill on the table view
    // follows (the query refetches), and the moment a waiter is on the way
    // is said out loud — it is what they were waiting for
    const onServiceRequest = (event?: ServiceRequestChangedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      if (event?.status === REQUEST_STATUS.acknowledged) {
        toast.success(
          event.acknowledgedBy
            ? translate('onTheWayBy', { name: event.acknowledgedBy })
            : translate('onTheWay'),
        )
        try {
          navigator.vibrate?.(200)
        } catch {
          // Not every browser lets a page buzz the phone
        }
      }
    }

    // The sitting at a scanned table ended — its bill paid or voided, or the
    // clock on a timed table stopped — for everyone who scanned it, ordered
    // or not. Paid gets the thanks card; the rest just let the table go.
    const onPlaceCleared = (event?: PlaceClearedEvent) => {
      const place = getActivePlace()
      if (!place || event?.placeId !== place.id) return
      if (event.reason === 'paid') {
        // Their own order's paid event, if any, adds the order id for rating
        const current = useThanksStore.getState().paid
        useThanksStore.getState().setPaid({
          placeName: place.name,
          receiptNumber: event.receiptNumber ?? null,
          orderId: current?.orderId ?? null,
        })
      }
      usePlaceStore.getState().clearPlace()
    }

    conn.on('OrderStatusChanged', onOrder)
    conn.on('RoomStatusChanged', onRoom)
    conn.on('BranchSettingsChanged', onBranchSettings)
    conn.on('CatalogChanged', onCatalog)
    conn.on('ServiceRequestChanged', onServiceRequest)
    conn.on('PlaceCleared', onPlaceCleared)
    ensureStarted(conn)

    // Every phone at a scanned table listens on that place's group, so the
    // bill ending the sitting reaches the friend who ordered nothing too.
    // Polled like the guest group: membership does not survive a reconnect,
    // and the place can change under us (a scan, a leave, a clear).
    let joinedPlace: { connectionId: string; placeId: number } | null = null
    const syncPlaceGroup = () => {
      if (conn.state !== HubConnectionState.Connected) return
      const connectionId = conn.connectionId ?? ''
      const placeId = getActivePlace()?.id ?? null
      if (
        joinedPlace?.connectionId === connectionId &&
        joinedPlace.placeId === placeId
      )
        return
      if (joinedPlace && joinedPlace.connectionId === connectionId) {
        conn.invoke('LeavePlaceGroup', joinedPlace.placeId).catch(() => {})
      }
      joinedPlace = null
      if (placeId != null) {
        conn.invoke('JoinPlaceGroup', placeId).catch(() => {})
        joinedPlace = { connectionId, placeId }
      }
    }
    syncPlaceGroup()
    const placeGroupTimer = setInterval(syncPlaceGroup, 2000)

    // Guests are only in their group by asking, and only once connected —
    // poll the connection the way useRoomsGroup does, since there is no
    // "connected" event to hang this off. The join is keyed on the
    // connection and the guest id together: a first-time guest gets their
    // id at checkout, after the connection is up, and must join then
    let joined: { connectionId: string; guestId: string } | null = null
    const joinIfNeeded = () => {
      if (conn.state !== HubConnectionState.Connected) return
      const connectionId = conn.connectionId ?? ''
      const guestId = getGuestId()
      if (
        !guestId ||
        (joined?.connectionId === connectionId && joined.guestId === guestId)
      )
        return
      joinGuestGroup(conn, (c, g) => {
        joined = { connectionId: c, guestId: g }
      })
    }
    joinIfNeeded()
    const guestGroupTimer = setInterval(joinIfNeeded, 2000)
    // And at once when the id is minted, rather than on the next tick
    const unsubscribeGuest = useGuestStore.subscribe(joinIfNeeded)

    // A start that failed (the token still being renewed, the network not
    // yet back) is not retried by automatic reconnect, which only covers a
    // drop of a connection that once was up — so keep trying until it is
    const retryTimer = setInterval(() => ensureStarted(conn), 5000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') ensureStarted(conn)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(guestGroupTimer)
      unsubscribeGuest()
      clearInterval(placeGroupTimer)
      clearInterval(retryTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
      conn.off('OrderStatusChanged', onOrder)
      conn.off('RoomStatusChanged', onRoom)
      conn.off('BranchSettingsChanged', onBranchSettings)
      conn.off('CatalogChanged', onCatalog)
      conn.off('ServiceRequestChanged', onServiceRequest)
      conn.off('PlaceCleared', onPlaceCleared)
    }
  }, [queryClient])
}

/** Joins the rooms broadcast group while the component is mounted; re-joins
 *  after reconnects (group membership does not survive them). */
export function useRoomsGroup() {
  useEffect(() => {
    const conn = getConnection()
    let disposed = false
    let joinedConnectionId: string | null = null

    const joinIfNeeded = () => {
      if (disposed || conn.state !== HubConnectionState.Connected) return
      if (joinedConnectionId === conn.connectionId) return
      conn
        .invoke('JoinRoomsGroup')
        .then(() => {
          joinedConnectionId = conn.connectionId ?? null
        })
        .catch(() => {})
    }

    ensureStarted(conn)
    joinIfNeeded()
    const timer = setInterval(joinIfNeeded, 2000)

    return () => {
      disposed = true
      clearInterval(timer)
      if (conn.state === HubConnectionState.Connected) {
        conn.invoke('LeaveRoomsGroup').catch(() => {})
      }
    }
  }, [])
}
