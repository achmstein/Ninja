import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import type { LocalizedText } from '@/api/spaces'
import { getGuestId, useGuestStore } from '@/stores/guest-store'
import { toast } from '@/lib/toast'
import { useT, type TranslationKey } from '@/lib/i18n'
import { placeKindName } from '@/lib/places'
import {
  cancelServiceRequest,
  createServiceRequest,
  getMyServiceRequests,
  REQUEST_STATUS,
  SERVICE_REQUEST,
  type ServiceRequestType,
  type ServiceRequestView,
} from '@/lib/services/notifications'

/** The place a request is sent from: a table the customer scanned, or the
 *  place of their running stay. */
export type RequestTarget = {
  placeId: number
  /** PlaceKind: 1 room, 2 table, 3 station */
  placeKind: number
  placeName: LocalizedText
  /** The running stay, when the request comes from one */
  sessionId?: number | null
}

/** Where one kind of request stands, as the pill shows it. */
export type RequestState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  /** Pending at the till: a tap takes it back */
  | { phase: 'sent'; id: number }
  /** Picked up: nothing to do but wait for them */
  | { phase: 'onTheWay'; id: number; by: string | null }

export const MY_REQUESTS_KEY = ['my-service-requests'] as const

const successKey: Partial<Record<ServiceRequestType, TranslationKey>> = {
  [SERVICE_REQUEST.callWaiter]: 'waiterNotified',
  [SERVICE_REQUEST.receiptToPay]: 'billRequestSent',
}

const isOpen = (r: ServiceRequestView) =>
  r.status === REQUEST_STATUS.pending ||
  r.status === REQUEST_STATUS.acknowledged

/**
 * The customer's requests from a place, with the state the till has put
 * them in (docs/visit-tab.html, phase 3). The open requests are one query
 * every surface shares — the chip in the top bar, the card on the menu and
 * the table view are on screen together — refetched when the hub says a
 * request moved, and polled as a fallback. The open request is the cooldown:
 * while one is sent or on the way, the pill cannot send another.
 */
export function useServiceRequests(target: RequestTarget) {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const ensureGuestId = useGuestStore((s) => s.ensureGuestId)
  const [pending, setPending] = useState<ServiceRequestType | null>(null)

  // Nobody to ask for: a guest gets an id with their first request
  const identified = auth.isAuthenticated || getGuestId() != null
  const { data: mine = [] } = useQuery({
    queryKey: MY_REQUESTS_KEY,
    queryFn: getMyServiceRequests,
    enabled: identified && target.placeId > 0,
    staleTime: 5_000,
    refetchInterval: 30_000,
  })

  const openOf = (type: ServiceRequestType) =>
    mine.find(
      (r) =>
        r.requestType === type &&
        Number(r.placeId) === target.placeId &&
        isOpen(r),
    )

  const stateOf = (type: ServiceRequestType): RequestState => {
    if (pending === type) return { phase: 'sending' }
    const open = openOf(type)
    if (!open) return { phase: 'idle' }
    return open.status === REQUEST_STATUS.acknowledged
      ? { phase: 'onTheWay', id: open.id, by: open.acknowledgedBy ?? null }
      : { phase: 'sent', id: open.id }
  }

  const setMine = (
    update: (prev: ServiceRequestView[]) => ServiceRequestView[],
  ) =>
    queryClient.setQueryData<ServiceRequestView[]>(MY_REQUESTS_KEY, (prev) =>
      update(prev ?? []),
    )

  const send = async (type: ServiceRequestType): Promise<boolean> => {
    if (stateOf(type).phase !== 'idle') return false
    if (!auth.isAuthenticated) ensureGuestId()
    setPending(type)
    try {
      const created = await createServiceRequest({
        requestType: type,
        placeId: target.placeId,
        placeKind: placeKindName(target.placeKind),
        placeName: target.placeName,
        sessionId: target.sessionId ?? null,
      })
      // Seen at once, then confirmed by the server's own list
      setMine((prev) => [created, ...prev.filter((r) => r.id !== created.id)])
      queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY })
      const key = successKey[type]
      if (key) toast.success(t(key))
      return true
    } catch {
      toast.error(t('failedToSendRequest'))
      return false
    } finally {
      setPending(null)
    }
  }

  const cancel = async (type: ServiceRequestType): Promise<boolean> => {
    const state = stateOf(type)
    if (state.phase !== 'sent') return false
    setPending(type)
    try {
      await cancelServiceRequest(state.id)
      setMine((prev) => prev.filter((r) => r.id !== state.id))
      toast.info(t('requestCancelled'))
      return true
    } catch (error) {
      // Too late: a waiter picked it up between the pill and the tap
      if (isAxiosError(error) && error.response?.status === 409) {
        toast.info(t('requestAlreadyPickedUp'))
      } else {
        toast.error(t('failedToSendRequest'))
      }
      return false
    } finally {
      setPending(null)
      queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY })
    }
  }

  /** What one tap on the pill does in its current state */
  const tap = (type: ServiceRequestType): Promise<boolean> => {
    const phase = stateOf(type).phase
    if (phase === 'idle') return send(type)
    if (phase === 'sent') return cancel(type)
    return Promise.resolve(false)
  }

  return { stateOf, send, cancel, tap, pending }
}
