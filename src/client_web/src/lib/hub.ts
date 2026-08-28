import { useEffect } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  type HubConnection,
} from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { getStoredUser } from './oidc'

// One SignalR connection for the whole app (mobile parity: single hub with
// OrderStatusChanged / RoomStatusChanged / BranchSettingsChanged events).
let connection: HubConnection | null = null

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

/** Mounted once in the root layout: starts the hub and maps events to query
 *  invalidations. */
export function useHub() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const conn = getConnection()

    const onOrder = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
    }
    const onRoom = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getAvailableRooms' }],
      })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMySessions' }] })
    }
    const onBranchSettings = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
    }

    conn.on('OrderStatusChanged', onOrder)
    conn.on('RoomStatusChanged', onRoom)
    conn.on('BranchSettingsChanged', onBranchSettings)
    ensureStarted(conn)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') ensureStarted(conn)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      conn.off('OrderStatusChanged', onOrder)
      conn.off('RoomStatusChanged', onRoom)
      conn.off('BranchSettingsChanged', onBranchSettings)
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
