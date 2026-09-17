import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addStayMemberMutation,
  assignStayCustomerMutation,
  cancelStayMutation,
  changeStayOptionMutation,
  confirmStayMutation,
  endStayMutation,
  getOpenStaysOptions,
  getStayOptions,
  holdPlaceMutation,
  listPlacesOptions,
  removeStayMemberMutation,
  startStayMutation,
  startWalkInMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import type { PlaceViewModel, StayViewModel } from '@/api/spaces/types.gen'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { PLACE_ROOM, STAY_HELD, STAY_RUNNING } from './status'

/**
 * The branch's places — rooms, tables, stations — and whatever is held or
 * running on them, the two reads behind every floor screen. SignalR's
 * RoomStatusChanged is the primary update path (see use-pos-notifications);
 * the polls are fallbacks.
 */
/** Orders names the way people read them: digit runs compare by value, so
 *  "Room 2" comes before "Room 10", and letter case does not matter. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function usePlaces({ enabled = true }: { enabled?: boolean } = {}) {
  const placesQuery = useQuery({
    ...listPlacesOptions(),
    enabled,
    refetchInterval: 60_000,
  })
  const staysQuery = useQuery({
    ...getOpenStaysOptions(),
    enabled,
    refetchInterval: 30_000,
  })

  // In the order people count them: Room 2 before Room 10; rooms first,
  // then tables, then stations
  const localized = useLocalized()
  const places = useMemo(
    () =>
      [...(placesQuery.data ?? [])].sort(
        (a, b) =>
          Number(a.kind ?? PLACE_ROOM) - Number(b.kind ?? PLACE_ROOM) ||
          naturalCompare(localized(a.name), localized(b.name)),
      ),
    [placesQuery.data, localized],
  )
  const stays = useMemo(() => staysQuery.data ?? [], [staysQuery.data])

  const stayForPlace = (
    placeId: number | string | undefined,
  ): StayViewModel | undefined =>
    stays.find(
      (s) =>
        toNumber(s.placeId) === toNumber(placeId) &&
        (Number(s.status) === STAY_RUNNING || Number(s.status) === STAY_HELD),
    )

  const runningStayById = (
    stayId: number | string,
  ): StayViewModel | undefined =>
    stays.find(
      (s) =>
        toNumber(s.id) === toNumber(stayId) &&
        Number(s.status) === STAY_RUNNING,
    )

  const placeById = (
    placeId: number | string | undefined,
  ): PlaceViewModel | undefined =>
    places.find((p) => toNumber(p.id) === toNumber(placeId))

  return {
    places,
    stays,
    stayForPlace,
    runningStayById,
    placeById,
    isLoading: placesQuery.isLoading,
  }
}

type Done = { onSuccess?: () => void }

/**
 * One stay by id, whatever its state. The open list stops carrying a stay
 * the moment it ends, but the ticket keeps reading it until the bill is
 * settled: the people there are still being named, and their shares still
 * go on their tabs.
 */
export function useStay(
  stayId: number | string | null | undefined,
  enabled = true,
): StayViewModel | undefined {
  const query = useQuery({
    ...getStayOptions({ path: { id: Number(stayId) } }),
    enabled: enabled && stayId != null,
    refetchInterval: 30_000,
    // Always fetch fresh when a screen opens: a member added on another screen
    // (or just now, before navigating straight into a new sale) must be on the
    // roster without a page refresh.
    refetchOnMount: 'always',
    staleTime: 0,
  })
  return query.data
}

/**
 * Every stay control the till has, each the same call admin_web makes.
 * Success refetches places, stays and tickets (ending a stay lands its
 * time on the ticket through the completed event) and toasts; failure
 * toasts. Callers pass `onSuccess` for what only they know, like closing
 * their own dialog.
 */
export function useStayActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenStays' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStay' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
  }

  const feedback = (
    success: TranslationKey | null,
    failure: TranslationKey,
  ) => ({
    onSuccess: () => {
      invalidate()
      if (success) toast.success(t(success))
    },
    onError: () => toast.error(t(failure)),
  })

  const startWalkIn = useMutation({
    ...startWalkInMutation(),
    ...feedback('sessionStarted', 'failedToStartSession'),
  })
  const startHeld = useMutation({
    ...startStayMutation(),
    ...feedback('sessionStarted', 'failedToStartSession'),
  })
  // Confirming a hold that asked for it starts the clock; one that did not
  // just stays held, and the toast says which
  const confirm = useMutation({
    ...confirmStayMutation(),
    ...feedback(null, 'failedToStartSession'),
  })
  const endStay = useMutation({
    ...endStayMutation(),
    ...feedback('sessionEnded', 'failedToEndSession'),
  })
  // Cancel toasts per call: a hold and a running stay read differently
  const cancelStay = useMutation({
    ...cancelStayMutation(),
    ...feedback(null, 'failedToCancelSession'),
  })
  const changeOption = useMutation({
    ...changeStayOptionMutation(),
    ...feedback('rateChanged', 'failedToChangeRate'),
  })
  const assignCustomer = useMutation({
    ...assignStayCustomerMutation(),
    ...feedback('customerAssigned', 'failedToAssignCustomer'),
  })
  const addMember = useMutation({
    ...addStayMemberMutation(),
    ...feedback('customerAdded', 'failedToAddCustomer'),
  })
  const removeMember = useMutation({
    ...removeStayMemberMutation(),
    ...feedback('memberRemoved', 'failedToRemoveMember'),
  })
  const hold = useMutation({
    ...holdPlaceMutation(),
    ...feedback('roomReserved', 'failedToReserveRoom'),
  })

  const isBusy =
    startWalkIn.isPending ||
    startHeld.isPending ||
    confirm.isPending ||
    endStay.isPending ||
    cancelStay.isPending ||
    changeOption.isPending ||
    assignCustomer.isPending ||
    addMember.isPending ||
    removeMember.isPending ||
    hold.isPending

  return {
    isBusy,
    startWalkIn: (placeId: number, optionCode: string | null, done?: Done) =>
      startWalkIn.mutate(
        { path: { id: placeId }, body: { notes: null, optionCode } },
        done,
      ),
    startHeld: (stayId: number, optionCode: string | null, done?: Done) =>
      startHeld.mutate({ path: { id: stayId }, body: { optionCode } }, done),
    confirm: (stayId: number, startsClock: boolean, done?: Done) =>
      confirm.mutate(
        { path: { id: stayId }, body: {} },
        {
          onSuccess: () => {
            toast.success(
              t(startsClock ? 'sessionStarted' : 'holdConfirmed'),
            )
            done?.onSuccess?.()
          },
        },
      ),
    endStay: (stayId: number, done?: Done) =>
      endStay.mutate({ path: { id: stayId } }, done),
    cancelStay: (stayId: number, wasRunning: boolean, done?: Done) =>
      cancelStay.mutate(
        { path: { id: stayId } },
        {
          onSuccess: () => {
            toast.success(
              t(wasRunning ? 'sessionCancelled' : 'reservationCancelled'),
            )
            done?.onSuccess?.()
          },
        },
      ),
    changeOption: (stayId: number, optionCode: string) =>
      changeOption.mutate({ path: { id: stayId }, body: { optionCode } }),
    assignCustomer: (
      stayId: number,
      customerId: string,
      customerName: string,
    ) =>
      assignCustomer.mutate({
        path: { id: stayId },
        body: { customerId, customerName },
      }),
    addMember: (stayId: number, customerId: string, customerName: string) =>
      addMember.mutate({
        path: { id: stayId },
        body: { customerId, customerName },
      }),
    removeMember: (stayId: number, customerId: string) =>
      removeMember.mutate({ path: { id: stayId, customerId } }),
    reserve: (placeId: number, customerName: string | null, done?: Done) =>
      hold.mutate(
        {
          path: { id: placeId },
          body: { customerName, notes: null, startOnConfirm: false },
        },
        done,
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
