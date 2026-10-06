import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DeliveryOrder, DeliveryStaffView, RiderView } from '@/api/ordering/types.gen'
import {
  assignDeliveryRiderMutation,
  cancelOrderMutation,
  getDeliveriesOptions,
  getRidersOptions,
  getTillDeliveryQuoteOptions,
  handInDeliveryCashMutation,
  handInRiderCashMutation,
  markDeliveryDeliveredMutation,
  markDeliveryFailedMutation,
  markDeliveryOutMutation,
  markDeliveryReturnedMutation,
  unassignDeliveryRiderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { brandQueryKey } from '@/lib/brand'
import { translate, type TranslationKey } from '@/lib/i18n'
import { isModuleOff, problemCode, problemMessage } from '@/lib/problem'
import type { StockDisposition } from '@/lib/stock-disposition'
import { toast } from '@/lib/toast'
import { useDebounced } from '@/lib/use-debounced'

export { laneOf, type DeliveryLane } from './delivery-format'

/** A delivery on the board: an order that is one, its delivery never missing */
export type BoardDelivery = DeliveryOrder & { delivery: DeliveryStaffView }

const isDelivery = (order: DeliveryOrder): order is BoardDelivery => order.delivery != null

/**
 * The branch's deliveries, live: the hub refetches them on every move
 * (use-pos-notifications), the poll only covers a dead socket. They keep
 * coming while delivery is switched off, so what is already out can finish.
 */
export function useDeliveries() {
  const query = useQuery({
    ...getDeliveriesOptions({ query: { 'api-version': API_VERSION } }),
    select: (orders) => orders.filter(isDelivery),
    refetchInterval: 20_000,
  })
  return { deliveries: query.data ?? [], isLoading: query.isLoading }
}

/**
 * The branch's riders, on duty first, as Ordering knows them: every account
 * given the branch in Staff (from Identity's events, never a call to it),
 * with whether their app has checked in. The hub refetches on every move.
 */
export function useRiders(enabled: boolean) {
  return useQuery({
    ...getRidersOptions({ query: { 'api-version': API_VERSION } }),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    select: (riders: RiderView[]) => riders.filter((r): r is RiderView & { userId: string } => !!r.userId),
  })
}

/**
 * The branch's answer for a delivery the till takes over the phone: whether
 * it delivers at all, its fee and minimum, and, for a location the caller
 * shared, the pin read from it and how far that is. `location` is debounced
 * so a paste reads once; the answer says which text it was for.
 */
export function useTillDeliveryQuote(location = '', enabled = true) {
  const pasted = useDebounced(location.trim(), 400)
  const query = useQuery({
    ...getTillDeliveryQuoteOptions({
      query: { 'api-version': API_VERSION, location: pasted || undefined },
    }),
    enabled,
    staleTime: 60_000,
    retry: (count, error) => !isModuleOff(error) && count < 2,
  })
  return { ...query, answeredFor: pasted, settled: pasted === location.trim() && !query.isFetching }
}

/** Every delivery step the till takes, each saying in the cashier's words what went wrong */
export function useDeliveryActions() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getDeliveries' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRiders' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
  }
  const failed = (error: unknown) => {
    // Someone else moved it first: show where it is now, then say so
    if (problemCode(error) === 'delivery.conflict') refresh()
    // The plan or the owner switched delivery off: the brand says so everywhere
    if (isModuleOff(error)) queryClient.invalidateQueries({ queryKey: brandQueryKey() })
    toast.error(problemMessage(error, translate))
  }
  const done = (said?: TranslationKey) => () => {
    refresh()
    if (said) toast.success(translate(said))
  }

  const assign = useMutation({ ...assignDeliveryRiderMutation(), onSuccess: done(), onError: failed })
  const unassign = useMutation({ ...unassignDeliveryRiderMutation(), onSuccess: done(), onError: failed })
  const out = useMutation({ ...markDeliveryOutMutation(), onSuccess: done(), onError: failed })
  const delivered = useMutation({ ...markDeliveryDeliveredMutation(), onSuccess: done(), onError: failed })
  const fail = useMutation({ ...markDeliveryFailedMutation(), onSuccess: done(), onError: failed })
  const returned = useMutation({ ...markDeliveryReturnedMutation(), onSuccess: done(), onError: failed })
  const cashIn = useMutation({ ...handInDeliveryCashMutation(), onSuccess: done('deliveryCashTaken'), onError: failed })
  const cancel = useMutation({ ...cancelOrderMutation(), onSuccess: done('orderCancelled'), onError: failed })
  // A rider's cash for several deliveries at once: all or nothing on the server
  const cashInMany = useMutation({ ...handInRiderCashMutation(), onSuccess: done(), onError: failed })

  const q = { 'api-version': API_VERSION }
  return {
    assign: (orderId: number, riderUserId: string) => assign.mutate({ path: { orderId }, body: { riderUserId }, query: q }),
    unassign: (orderId: number) => unassign.mutate({ path: { orderId }, query: q }),
    markOut: (orderId: number) => out.mutate({ path: { orderId }, query: q }),
    markDelivered: (orderId: number) => delivered.mutate({ path: { orderId }, query: q }),
    markFailed: (orderId: number, reason: string) =>
      fail.mutate({ path: { orderId }, body: { reason: reason.trim() || null }, query: q }),
    markReturned: (orderId: number) => returned.mutate({ path: { orderId }, query: q }),
    cashIn: (orderId: number, amount: number) => cashIn.mutate({ path: { orderId }, body: { amount }, query: q }),
    cashInMany: (amounts: Map<number, number>, then?: () => void) =>
      cashInMany.mutate(
        { body: { items: [...amounts].map(([orderId, amount]) => ({ orderId, amount })) }, query: q },
        {
          onSuccess: () => {
            toast.success(translate('riderCashTaken', { count: amounts.size }))
            then?.()
          },
        },
      ),
    // A delivery that failed or came back, its cash never in: the order goes, the
    // customer charged nothing, and its food goes as the cashier said
    cancel: (orderId: number, stockDisposition: StockDisposition) =>
      cancel.mutate({
        body: { orderNumber: orderId, stockDisposition },
        headers: { 'x-requestid': crypto.randomUUID() },
        query: q,
      }),
    busy: [assign, unassign, out, delivered, fail, returned, cashIn, cancel, cashInMany].some((m) => m.isPending),
  }
}
