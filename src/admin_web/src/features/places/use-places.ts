import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type OrderSummary } from '@/api/ordering'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import {
  type PlaceViewModel,
  type ReservationViewModel,
  type StayViewModel,
} from '@/api/spaces'
import {
  addStayMemberMutation,
  assignReservationCustomerMutation,
  assignStayCustomerMutation,
  cancelReservationMutation,
  cancelStayMutation,
  changeStayOptionMutation,
  confirmReservationMutation,
  deletePlaceMutation,
  endStayMutation,
  getOpenReservationsOptions,
  getOpenStaysOptions,
  listPlacesOptions,
  removeStayMemberMutation,
  reservePlaceMutation,
  seatReservationMutation,
  setPlaceActiveMutation,
  setPlaceStatusMutation,
  startWalkInMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { comparePlaces, reservationForPlace, stayForPlace } from './status'

const NO_PLACES: PlaceViewModel[] = []
const NO_STAYS: StayViewModel[] = []
const NO_RESERVATIONS: ReservationViewModel[] = []
const NO_ORDERS: OrderSummary[] = []

/**
 * The branch's places — rooms, tables, stations — whatever is running on
 * them, and whoever has reserved one: the three reads behind the floor
 * page and the dashboard. SignalR's RoomStatusChanged is the primary
 * update path (see use-admin-notifications); the polls are fallbacks.
 */
export function usePlaces() {
  const localized = useLocalized()
  const placesQuery = useQuery({
    ...listPlacesOptions(),
    refetchInterval: 60_000,
  })
  const staysQuery = useQuery({
    ...getOpenStaysOptions(),
    refetchInterval: 60_000,
  })
  const reservationsQuery = useQuery({
    ...getOpenReservationsOptions(),
    refetchInterval: 60_000,
  })

  const places = useMemo(
    () => [...(placesQuery.data ?? NO_PLACES)].sort(comparePlaces(localized)),
    [placesQuery.data, localized]
  )
  const stays = staysQuery.data ?? NO_STAYS
  const reservations = reservationsQuery.data ?? NO_RESERVATIONS

  return {
    places,
    stays,
    reservations,
    stayFor: (placeId: number | string | undefined) =>
      stayForPlace(stays, placeId),
    reservationFor: (placeId: number | string | undefined) =>
      reservationForPlace(reservations, placeId),
    isLoading: placesQuery.isLoading,
    isPending: placesQuery.isPending || staysQuery.isPending,
    error: placesQuery.error ?? staysQuery.error ?? reservationsQuery.error,
    refetch: () => {
      placesQuery.refetch()
      staysQuery.refetch()
      reservationsQuery.refetch()
    },
  }
}

/** Whether a pending order belongs to a place. */
export function orderIsAt(order: OrderSummary, place: PlaceViewModel): boolean {
  return order.placeId != null && Number(order.placeId) === Number(place.id)
}

/**
 * Ordering's pending orders, oldest first, and a lookup of the ones waiting
 * on a given place.
 */
export function usePendingOrders() {
  const query = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR order events are the primary update path; this poll is a fallback
    refetchInterval: 60_000,
  })
  const pending = useMemo(
    () =>
      [...(query.data ?? NO_ORDERS)].sort(
        (a, b) =>
          new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
      ),
    [query.data]
  )
  return {
    pending,
    ordersAt: (place: PlaceViewModel) =>
      pending.filter((order) => orderIsAt(order, place)),
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
  }
}

/** The server's reason when it refuses, else the fallback. */
export function problemDetail(error: unknown, fallback: string): string {
  const problem = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data
  return problem?.detail ?? fallback
}

type Done = { onSuccess?: () => void }

/**
 * Every place, reservation and stay control the admin has. Success
 * refetches places, stays and reservations and toasts; failure toasts the
 * server's reason where it gives one. Callers pass `onSuccess` for what
 * only they know, like closing their own dialog.
 */
export function useStayActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenStays' }] })
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getOpenReservations' }],
    })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStay' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStayHistory' }] })
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getReservationHistory' }],
    })
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getPlaceReservationHistory' }],
    })
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getPlaceStayHistory' }],
    })
  }

  const feedback = (
    success: TranslationKey | null,
    failure: TranslationKey
  ) => ({
    onSuccess: () => {
      invalidate()
      if (success) toast.success(t(success))
    },
    onError: (error: unknown) => toast.error(problemDetail(error, t(failure))),
  })

  const reserve = useMutation({
    ...reservePlaceMutation(),
    ...feedback(null, 'failedToHold'),
  })
  const walkIn = useMutation({
    ...startWalkInMutation(),
    ...feedback('clockStarted', 'failedToStartClock'),
  })
  // Seating a reservation at a timed place starts the clock; at a plain
  // table it just closes the reservation, and the toast says which
  const seat = useMutation({
    ...seatReservationMutation(),
    ...feedback(null, 'failedToStartClock'),
  })
  // Confirming a reservation that asked for it seats the party and starts
  // the clock; one that did not just stays reserved, and the toast says which
  const confirm = useMutation({
    ...confirmReservationMutation(),
    ...feedback(null, 'failedToConfirm'),
  })
  const endStay = useMutation({
    ...endStayMutation(),
    ...feedback('timeEnded', 'failedToEndTime'),
  })
  const cancelStay = useMutation({
    ...cancelStayMutation(),
    ...feedback('timeCancelled', 'failedToCancelHold'),
  })
  const cancelReservation = useMutation({
    ...cancelReservationMutation(),
    ...feedback('holdCancelled', 'failedToCancelHold'),
  })
  const assignReservationCustomer = useMutation({
    ...assignReservationCustomerMutation(),
    ...feedback('customerAssigned', 'failedToAssignCustomer'),
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
  const setActive = useMutation({
    ...setPlaceActiveMutation(),
    ...feedback('placeSaved', 'failedToSavePlace'),
  })
  const setStatus = useMutation({
    ...setPlaceStatusMutation(),
    ...feedback('placeSaved', 'failedToSavePlace'),
  })
  // The server refuses while a stay is held or running; its reason shows
  const deletePlace = useMutation({
    ...deletePlaceMutation(),
    ...feedback('placeDeleted', 'failedToDeletePlace'),
  })

  const isBusy =
    reserve.isPending ||
    walkIn.isPending ||
    seat.isPending ||
    confirm.isPending ||
    endStay.isPending ||
    cancelStay.isPending ||
    cancelReservation.isPending ||
    assignReservationCustomer.isPending ||
    changeOption.isPending ||
    assignCustomer.isPending ||
    addMember.isPending ||
    removeMember.isPending ||
    setActive.isPending ||
    setStatus.isPending ||
    deletePlace.isPending

  const customer = (customerId: string, customerName: string | null) => ({
    customerId,
    customerName,
  })

  return {
    isBusy,
    invalidate,
    reserve: (
      placeId: number,
      body: {
        customerName: string | null
        notes: string | null
        startOnConfirm: boolean
        for?: string | null
        partySize?: number | null
      },
      done?: { onSuccess?: (reservationId: number) => void }
    ) =>
      reserve.mutate(
        { body: { placeId, ...body } },
        { onSuccess: (id) => done?.onSuccess?.(Number(id)) }
      ),
    walkIn: (
      placeId: number,
      body: { optionCode: string | null; notes: string | null },
      done?: Done
    ) => walkIn.mutate({ path: { id: placeId }, body }, done),
    seat: (
      reservationId: number,
      optionCode: string | null,
      timed: boolean,
      done?: Done
    ) =>
      seat.mutate(
        { path: { id: reservationId }, body: { optionCode } },
        {
          onSuccess: () => {
            toast.success(t(timed ? 'clockStarted' : 'partySeated'))
            done?.onSuccess?.()
          },
        }
      ),
    confirm: (
      reservationId: number,
      optionCode: string | null,
      startsClock: boolean,
      done?: Done
    ) =>
      confirm.mutate(
        { path: { id: reservationId }, body: { optionCode } },
        {
          onSuccess: () => {
            toast.success(t(startsClock ? 'clockStarted' : 'confirmed'))
            done?.onSuccess?.()
          },
        }
      ),
    endStay: (stayId: number, done?: Done) =>
      endStay.mutate({ path: { id: stayId } }, done),
    cancelStay: (stayId: number, done?: Done) =>
      cancelStay.mutate({ path: { id: stayId } }, done),
    cancelReservation: (reservationId: number, done?: Done) =>
      cancelReservation.mutate({ path: { id: reservationId } }, done),
    assignReservationCustomer: (
      reservationId: number,
      customerId: string,
      customerName: string | null,
      done?: Done
    ) =>
      assignReservationCustomer.mutate(
        {
          path: { id: reservationId },
          body: customer(customerId, customerName),
        },
        done
      ),
    changeOption: (stayId: number, optionCode: string, done?: Done) =>
      changeOption.mutate({ path: { id: stayId }, body: { optionCode } }, done),
    assignCustomer: (
      stayId: number,
      customerId: string,
      customerName: string | null,
      done?: Done
    ) =>
      assignCustomer.mutate(
        { path: { id: stayId }, body: customer(customerId, customerName) },
        done
      ),
    addMember: (
      stayId: number,
      customerId: string,
      customerName: string | null,
      done?: Done
    ) =>
      addMember.mutate(
        { path: { id: stayId }, body: customer(customerId, customerName) },
        done
      ),
    removeMember: (stayId: number, customerId: string, done?: Done) =>
      removeMember.mutate({ path: { id: stayId, customerId } }, done),
    setActive: (placeId: number, isActive: boolean, done?: Done) =>
      setActive.mutate({ path: { id: placeId }, body: { isActive } }, done),
    setStatus: (placeId: number, status: number, done?: Done) =>
      setStatus.mutate({ path: { id: placeId }, query: { status } }, done),
    deletePlace: (placeId: number, done?: Done) =>
      deletePlace.mutate({ path: { id: placeId } }, done),
  }
}
