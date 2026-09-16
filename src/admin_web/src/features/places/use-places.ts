import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type OrderSummary } from '@/api/ordering'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { type PlaceViewModel, type StayViewModel } from '@/api/spaces'
import {
  addStayMemberMutation,
  assignStayCustomerMutation,
  cancelStayMutation,
  changeStayOptionMutation,
  confirmStayMutation,
  deletePlaceMutation,
  endStayMutation,
  getOpenStaysOptions,
  holdPlaceMutation,
  listPlacesOptions,
  removeStayMemberMutation,
  setPlaceActiveMutation,
  setPlaceStatusMutation,
  startStayMutation,
  startWalkInMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { comparePlaces, stayForPlace } from './status'

const NO_PLACES: PlaceViewModel[] = []
const NO_STAYS: StayViewModel[] = []
const NO_ORDERS: OrderSummary[] = []

/**
 * The branch's places — rooms, tables, stations — and whatever is held or
 * running on them: the two reads behind the floor page and the dashboard.
 * SignalR's RoomStatusChanged is the primary update path (see
 * use-admin-notifications); the polls are fallbacks.
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

  const places = useMemo(
    () => [...(placesQuery.data ?? NO_PLACES)].sort(comparePlaces(localized)),
    [placesQuery.data, localized]
  )
  const stays = staysQuery.data ?? NO_STAYS

  return {
    places,
    stays,
    stayFor: (placeId: number | string | undefined) =>
      stayForPlace(stays, placeId),
    isLoading: placesQuery.isLoading,
    isPending: placesQuery.isPending || staysQuery.isPending,
    error: placesQuery.error ?? staysQuery.error,
    refetch: () => {
      placesQuery.refetch()
      staysQuery.refetch()
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
 * Every place and stay control the admin has. Success refetches places and
 * stays and toasts; failure toasts the server's reason where it gives one.
 * Callers pass `onSuccess` for what only they know, like closing their own
 * dialog.
 */
export function useStayActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenStays' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStay' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStayHistory' }] })
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

  const hold = useMutation({
    ...holdPlaceMutation(),
    ...feedback(null, 'failedToHold'),
  })
  const walkIn = useMutation({
    ...startWalkInMutation(),
    ...feedback('clockStarted', 'failedToStartClock'),
  })
  const startHeld = useMutation({
    ...startStayMutation(),
    ...feedback('clockStarted', 'failedToStartClock'),
  })
  // Confirming a hold that asked for it starts the clock; one that did not
  // just stays held, and the toast says which
  const confirm = useMutation({
    ...confirmStayMutation(),
    ...feedback(null, 'failedToConfirm'),
  })
  const endStay = useMutation({
    ...endStayMutation(),
    ...feedback('timeEnded', 'failedToEndTime'),
  })
  // Cancel toasts per call: a hold and a running stay read differently
  const cancelStay = useMutation({
    ...cancelStayMutation(),
    ...feedback(null, 'failedToCancelHold'),
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
    hold.isPending ||
    walkIn.isPending ||
    startHeld.isPending ||
    confirm.isPending ||
    endStay.isPending ||
    cancelStay.isPending ||
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
    hold: (
      placeId: number,
      body: {
        customerName: string | null
        notes: string | null
        startOnConfirm: boolean
      },
      done?: { onSuccess?: (stayId: number) => void }
    ) =>
      hold.mutate(
        { path: { id: placeId }, body },
        { onSuccess: (stayId) => done?.onSuccess?.(Number(stayId)) }
      ),
    walkIn: (
      placeId: number,
      body: { optionCode: string | null; notes: string | null },
      done?: Done
    ) => walkIn.mutate({ path: { id: placeId }, body }, done),
    startHeld: (stayId: number, optionCode: string | null, done?: Done) =>
      startHeld.mutate({ path: { id: stayId }, body: { optionCode } }, done),
    confirm: (
      stayId: number,
      optionCode: string | null,
      startsClock: boolean,
      done?: Done
    ) =>
      confirm.mutate(
        { path: { id: stayId }, body: { optionCode } },
        {
          onSuccess: () => {
            toast.success(t(startsClock ? 'clockStarted' : 'confirmed'))
            done?.onSuccess?.()
          },
        }
      ),
    endStay: (stayId: number, done?: Done) =>
      endStay.mutate({ path: { id: stayId } }, done),
    cancelStay: (stayId: number, wasHeld: boolean, done?: Done) =>
      cancelStay.mutate(
        { path: { id: stayId } },
        {
          onSuccess: () => {
            toast.success(t(wasHeld ? 'holdCancelled' : 'timeCancelled'))
            done?.onSuccess?.()
          },
        }
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
