import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { renewSession } from './session'

/** What a handler can do besides its own work: refresh queries by their operation id */
export type HubTools = {
  refresh: (...ids: string[]) => void
  queryClient: QueryClient
}

export type StaffHubOptions = {
  /** The signed-in user's access token (the app's getStoredUser) */
  getToken: () => string | undefined
  /** The hub methods that join this app's groups (JoinAdminGroup, JoinRoomsGroup) */
  groups: string[]
  /**
   * The table: each event and the queries (generated operation ids) it makes
   * stale. They are refreshed before the event's handler in [on] runs.
   */
  refreshes: Record<string, string[]>
  /** What else an event does: a chime, a toast, a refresh that depends on the payload */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?: Record<string, (payload: any, tools: HubTools) => void>
  /** Asked again after the connection was lost and came back: what it may have missed */
  catchUp: string[]
}

/**
 * One SignalR connection for a staff app's session (mounted in the signed-in
 * layout), mapping hub events to query refreshes so lists stay live without
 * polling. A refresh reaches a query even when it is off-screen (refetchType
 * 'all'), and carries X-Branch-Id, so it stays branch-scoped.
 *
 * The hardening the till learned: back-off on a failed start, the groups joined
 * again and what was missed asked again after a reconnect, a fresh start some
 * time after automatic reconnect gives up, and when the tab is shown again. The
 * options are read when an event arrives, so the app may pass a new object each
 * render; the connection opens once.
 */
export function useStaffHub(options: StaffHubOptions) {
  const queryClient = useQueryClient()
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hub/notifications', {
        // Asked on every (re)connection. A token that ran out (the PC slept
        // through its renewal) is renewed first: the hub would not refuse it
        // but take the page for a guest, whose group join is turned down, and
        // nothing would reach it
        accessTokenFactory: async () => {
          await renewSession().catch(() => false)
          return latest.current.getToken() ?? ''
        },
      })
      .withAutomaticReconnect()
      .build()

    const refresh = (...ids: string[]) => {
      for (const id of ids) queryClient.invalidateQueries({ queryKey: [{ _id: id }], refetchType: 'all' })
    }
    const tools: HubTools = { refresh, queryClient }

    const events = new Set([...Object.keys(options.refreshes), ...Object.keys(options.on ?? {})])
    for (const event of events) {
      connection.on(event, (payload: unknown) => {
        refresh(...(latest.current.refreshes[event] ?? []))
        latest.current.on?.[event]?.(payload, tools)
      })
    }

    const joinGroups = () =>
      Promise.allSettled(
        latest.current.groups.map((group) =>
          // eslint-disable-next-line no-console -- a failed join is worth seeing in the console
          connection.invoke(group).catch((error) => console.warn(`[signalr] ${group} failed:`, error))
        )
      )
    const catchUp = () => refresh(...latest.current.catchUp)

    let disposed = false
    let connectedBefore = false
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroups()
        // A connection opened afresh after one was lost missed what was sent
        // in between, just as a reconnected one did
        if (connectedBefore) catchUp()
        connectedBefore = true
      } catch (error) {
        // eslint-disable-next-line no-console -- as is a failed connection
        console.warn('[signalr] connect failed:', error)
        // Never giving up while the page is open: a screen left on all day
        // must come back by itself when the network does
        if (!disposed && connection.state === HubConnectionState.Disconnected) {
          setTimeout(() => start(attempt + 1), Math.min(5_000 * (attempt + 1), 30_000))
        }
      }
    }

    void start()

    connection.onreconnected(() => {
      // New connection id: the groups must be joined again, and anything
      // missed while offline asked again
      joinGroups().catch(() => {})
      catchUp()
    })

    // Automatic reconnect gave up (the network or the PC out for minutes). The
    // page may stay in front all day, so no tab change will come to reopen it
    connection.onclose(() => {
      if (disposed) return
      setTimeout(() => {
        if (!disposed && connection.state === HubConnectionState.Disconnected) void start()
      }, 30_000)
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && connection.state === HubConnectionState.Disconnected) void start()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibility)
      connection.stop().catch(() => {})
    }
    // The connection opens once; events read the latest options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient])
}
