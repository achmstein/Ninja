import { useEffect } from 'react'
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { getStoredUser } from '@/config/oidc-config'

/**
 * One SignalR connection for the whole POS session (mounted in the
 * authenticated layout). Joins the admin group and maps TicketUpdated to
 * query invalidations, so the floor and open ticket screens stay live.
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
        accessTokenFactory: () => getStoredUser()?.access_token ?? '',
      })
      .withAutomaticReconnect()
      .build()

    const invalidateTickets = () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      // The sale pad polls the order → ticket lookup while the confirmation
      // event is in flight; the signal short-circuits its 600ms wait
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getTicketByOrder' }],
      })
    }

    // Broadcast to the whole admin group; the branch filter lives in the
    // query layer (the refetch carries X-Branch-Id), so a blanket
    // invalidation is always safe.
    connection.on('TicketUpdated', () => {
      invalidateTickets()
    })

    const joinGroup = () =>
      connection
        .invoke('JoinAdminGroup')
        .catch((error) =>
          console.warn('[signalr] JoinAdminGroup failed:', error)
        )

    let disposed = false
    const start = async (attempt = 0) => {
      try {
        await connection.start()
        await joinGroup()
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
      // New connection id: the group must be rejoined, and anything missed
      // while offline refetched.
      joinGroup().catch(() => {})
      invalidateTickets()
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
