import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMemberToSessionMutation,
  assignCustomerToSessionMutation,
  cancelSessionMutation,
  changePlayerModeMutation,
  endSessionMutation,
  getActiveSessionsOptions,
  getSessionOptions,
  listRoomsOptions,
  removeMemberFromSessionMutation,
  reserveRoomMutation,
  startSessionMutation,
  startWalkInSessionMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import type { ReservationViewModel } from '@/api/spaces/types.gen'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { type PlayerMode, SESSION_ACTIVE, SESSION_RESERVED } from './status'

/**
 * The branch's rooms and whatever is reserved or running in them, the two
 * reads behind every room screen. SignalR's RoomStatusChanged is the
 * primary update path (see use-pos-notifications); the polls are fallbacks.
 */
/** Orders names the way people read them: digit runs compare by value, so
 *  "Room 2" comes before "Room 10", and letter case does not matter. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function useRooms({ enabled = true }: { enabled?: boolean } = {}) {
  const roomsQuery = useQuery({
    ...listRoomsOptions(),
    enabled,
    refetchInterval: 60_000,
  })
  const sessionsQuery = useQuery({
    ...getActiveSessionsOptions(),
    enabled,
    refetchInterval: 30_000,
  })

  // In the order people count them: Room 2 before Room 10
  const localized = useLocalized()
  const rooms = useMemo(
    () =>
      [...(roomsQuery.data ?? [])].sort((a, b) =>
        naturalCompare(localized(a.name), localized(b.name))
      ),
    [roomsQuery.data, localized]
  )
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data])

  const sessionForRoom = (
    roomId: number | string | undefined
  ): ReservationViewModel | undefined =>
    sessions.find(
      (s) =>
        toNumber(s.roomId) === toNumber(roomId) &&
        (Number(s.status) === SESSION_ACTIVE ||
          Number(s.status) === SESSION_RESERVED)
    )

  const activeSessionById = (
    sessionId: number | string
  ): ReservationViewModel | undefined =>
    sessions.find(
      (s) =>
        toNumber(s.id) === toNumber(sessionId) &&
        Number(s.status) === SESSION_ACTIVE
    )

  return {
    rooms,
    sessions,
    sessionForRoom,
    activeSessionById,
    isLoading: roomsQuery.isLoading,
  }
}

type Done = { onSuccess?: () => void }

/**
 * Every session control the till has, each the same call admin_web makes.
 * Success refetches rooms, sessions and tickets (ending a session lands its
 * time on the ticket through the completed event) and toasts; failure
 * toasts. Callers pass `onSuccess` for what only they know, like closing
 * their own dialog.
 */
/**
 * One session by id, whatever its state. The active list stops carrying a
 * session the moment it ends, but the ticket keeps reading it until the
 * bill is settled: the people in the room are still being named, and
 * their shares still go on their tabs.
 */
export function useSession(
  sessionId: number | string | null | undefined,
  enabled = true
): ReservationViewModel | undefined {
  const query = useQuery({
    ...getSessionOptions({ path: { sessionId: Number(sessionId) } }),
    enabled: enabled && sessionId != null,
    refetchInterval: 30_000,
    // Always fetch fresh when a screen opens: a member added on another screen
    // (or just now, before navigating straight into a new sale) must be on the
    // roster without a page refresh.
    refetchOnMount: 'always',
    staleTime: 0,
  })
  return query.data
}

export function useSessionActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getActiveSessions' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getSession' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
  }

  const feedback = (success: TranslationKey | null, failure: TranslationKey) => ({
    onSuccess: () => {
      invalidate()
      if (success) toast.success(t(success))
    },
    onError: () => toast.error(t(failure)),
  })

  const startWalkIn = useMutation({
    ...startWalkInSessionMutation(),
    ...feedback('sessionStarted', 'failedToStartSession'),
  })
  const startReserved = useMutation({
    ...startSessionMutation(),
    ...feedback('sessionStarted', 'failedToStartSession'),
  })
  const endSession = useMutation({
    ...endSessionMutation(),
    ...feedback('sessionEnded', 'failedToEndSession'),
  })
  // Cancel toasts per call: a reservation and a running session read differently
  const cancelSession = useMutation({
    ...cancelSessionMutation(),
    ...feedback(null, 'failedToCancelSession'),
  })
  const changeMode = useMutation({
    ...changePlayerModeMutation(),
    ...feedback('playerModeUpdated', 'failedToChangePlayerMode'),
  })
  const assignCustomer = useMutation({
    ...assignCustomerToSessionMutation(),
    ...feedback('customerAssigned', 'failedToAssignCustomer'),
  })
  const addMember = useMutation({
    ...addMemberToSessionMutation(),
    ...feedback('customerAdded', 'failedToAddCustomer'),
  })
  const removeMember = useMutation({
    ...removeMemberFromSessionMutation(),
    ...feedback('memberRemoved', 'failedToRemoveMember'),
  })
  const reserve = useMutation({
    ...reserveRoomMutation(),
    ...feedback('roomReserved', 'failedToReserveRoom'),
  })

  const isBusy =
    startWalkIn.isPending ||
    startReserved.isPending ||
    endSession.isPending ||
    cancelSession.isPending ||
    changeMode.isPending ||
    assignCustomer.isPending ||
    addMember.isPending ||
    removeMember.isPending ||
    reserve.isPending

  return {
    isBusy,
    startWalkIn: (roomId: number, playerMode: PlayerMode | null, done?: Done) =>
      startWalkIn.mutate(
        { path: { roomId }, body: { notes: null, playerMode } },
        done
      ),
    startReserved: (sessionId: number, playerMode: PlayerMode | null, done?: Done) =>
      startReserved.mutate({ path: { sessionId }, body: { playerMode } }, done),
    endSession: (sessionId: number, done?: Done) =>
      endSession.mutate({ path: { sessionId } }, done),
    cancelSession: (sessionId: number, wasActive: boolean, done?: Done) =>
      cancelSession.mutate(
        { path: { sessionId } },
        {
          onSuccess: () => {
            toast.success(t(wasActive ? 'sessionCancelled' : 'reservationCancelled'))
            done?.onSuccess?.()
          },
        }
      ),
    changeMode: (sessionId: number, playerMode: PlayerMode) =>
      changeMode.mutate({ path: { sessionId }, body: { playerMode } }),
    assignCustomer: (sessionId: number, customerId: string, customerName: string) =>
      assignCustomer.mutate({
        path: { sessionId },
        body: { customerId, customerName },
      }),
    addMember: (sessionId: number, customerId: string, customerName: string) =>
      addMember.mutate({ path: { sessionId }, body: { customerId, customerName } }),
    removeMember: (sessionId: number, customerId: string) =>
      removeMember.mutate({ path: { sessionId, customerId } }),
    reserve: (roomId: number, customerName: string | null, done?: Done) =>
      reserve.mutate(
        { path: { roomId }, body: { customerName, notes: null } },
        done
      ),
  }
}

/** A one-second clock for live timers and countdowns, off while nothing shows one. */
export function useSecondsClock(enabled = true): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])

  return nowMs
}
