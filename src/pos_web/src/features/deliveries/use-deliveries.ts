import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DeliveryOrder } from '@/api/ordering/types.gen'
import {
  assignDeliveryRiderMutation,
  getDeliveriesOptions,
  getRidersOptions,
  handInDeliveryCashMutation,
  unassignDeliveryRiderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'

export type DeliveryLane = 'waiting' | 'withRider' | 'cashDue' | 'done'

/** Where a delivery stands for the till: nobody has it, a rider has it, its cash is still out, or settled */
export function laneOf(order: DeliveryOrder): DeliveryLane {
  const d = order.delivery
  if (d?.cashHandedInAt || order.paidAt) return 'done'
  if (d?.deliveredAt) return 'cashDue'
  if (d?.riderUserId) return 'withRider'
  return 'waiting'
}

/**
 * The branch's deliveries and its riders, live: the hub refetches both on
 * every move (use-pos-notifications), the poll only covers a dead socket.
 */
export function useDeliveries() {
  const query = useQuery({
    ...getDeliveriesOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 20_000,
  })
  return { deliveries: query.data ?? [], isLoading: query.isLoading }
}

export function useRiders(enabled: boolean) {
  return useQuery({
    ...getRidersOptions({ query: { 'api-version': API_VERSION } }),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })
}

/** Giving a delivery to a rider, taking it back, and taking the rider's cash in */
export function useDeliveryActions() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getDeliveries' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRiders' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
  }
  const failed = (error: unknown) => {
    const message = (error as { response?: { data?: unknown } })?.response?.data
    toast.error(typeof message === 'string' && message ? message : translate('deliveryActionFailed'))
  }

  const assign = useMutation({ ...assignDeliveryRiderMutation(), onSuccess: refresh, onError: failed })
  const unassign = useMutation({ ...unassignDeliveryRiderMutation(), onSuccess: refresh, onError: failed })
  const cashIn = useMutation({
    ...handInDeliveryCashMutation(),
    onSuccess: () => {
      refresh()
      toast.success(translate('deliveryCashTaken'))
    },
    onError: failed,
  })

  return {
    assign: (orderId: number, riderUserId: string, riderName: string) =>
      assign.mutate({ path: { orderId }, body: { riderUserId, riderName }, query: { 'api-version': API_VERSION } }),
    unassign: (orderId: number) => unassign.mutate({ path: { orderId }, query: { 'api-version': API_VERSION } }),
    cashIn: (orderId: number) => cashIn.mutate({ path: { orderId }, query: { 'api-version': API_VERSION } }),
    busy: assign.isPending || unassign.isPending || cashIn.isPending,
  }
}
