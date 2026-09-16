import { useEffect } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  type HubConnection,
} from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getGuestId } from '@/stores/guest-store'
import { getStoredUser } from './oidc'
import { translate } from './i18n'
import { toast } from './toast'

// One SignalR connection for the whole app (mobile parity: single hub with
// OrderStatusChanged / RoomStatusChanged / BranchSettingsChanged /
// CatalogChanged events).
let connection: HubConnection | null = null

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
}

function getConnection(): HubConnection {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl('/hub/notifications', {
        accessTokenFactory: () => getStoredUser()?.access_token ?? '',
      })
      .withAutomaticReconnect()
      .build()
  }
  return connection
}

function ensureStarted(conn: HubConnection) {
  if (conn.state === HubConnectionState.Disconnected) {
    conn.start().catch(() => {})
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
function joinGuestGroup(conn: HubConnection): string | null {
  if (conn.state !== HubConnectionState.Connected) return null
  if (getStoredUser()?.access_token) return null

  const guestId = getGuestId()
  if (!guestId) return null

  conn.invoke('JoinGuestGroup', guestId).catch(() => {})
  return conn.connectionId ?? null
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

    conn.on('OrderStatusChanged', onOrder)
    conn.on('RoomStatusChanged', onRoom)
    conn.on('BranchSettingsChanged', onBranchSettings)
    conn.on('CatalogChanged', onCatalog)
    ensureStarted(conn)

    // Guests are only in their group by asking, and only once connected —
    // poll the connection the way useRoomsGroup does, since there is no
    // "connected" event to hang this off
    let joinedConnectionId: string | null = null
    const joinIfNeeded = () => {
      if (joinedConnectionId === conn.connectionId) return
      joinedConnectionId = joinGuestGroup(conn)
    }
    joinIfNeeded()
    const guestGroupTimer = setInterval(joinIfNeeded, 2000)

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
      clearInterval(retryTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
      conn.off('OrderStatusChanged', onOrder)
      conn.off('RoomStatusChanged', onRoom)
      conn.off('BranchSettingsChanged', onBranchSettings)
      conn.off('CatalogChanged', onCatalog)
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
