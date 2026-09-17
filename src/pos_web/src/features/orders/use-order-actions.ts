import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  cancelOrderMutation,
  confirmOrderMutation,
  rejectGuestOrderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'

/**
 * Confirm / cancel a pending order, the same two calls the admin board
 * makes. Each carries a fresh idempotency key: a double tap on a slow
 * connection must not turn into two commands.
 *
 * Confirming lands the lines on a ticket through the order-confirmed event,
 * so the ticket queries refetch on the TicketUpdated signal that follows —
 * only the order queries are invalidated here.
 */
export function useOrderActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getPendingOrders' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
  }

  const confirmOrder = useMutation({
    ...confirmOrderMutation(),
    onSuccess: () => {
      invalidateOrders()
      toast.success(t('orderConfirmed'))
    },
    onError: () => toast.error(t('failedToConfirmOrder')),
  })

  const cancelOrder = useMutation({
    ...cancelOrderMutation(),
    onSuccess: () => {
      invalidateOrders()
      toast.success(t('orderCancelled'))
    },
    onError: () => toast.error(t('failedToCancelOrder')),
  })

  // "Nobody at the table": the order goes and the device that placed it is
  // turned away for the day
  const rejectGuestOrder = useMutation({
    ...rejectGuestOrderMutation(),
    onSuccess: () => {
      invalidateOrders()
      toast.success(t('guestTurnedAway'))
    },
    onError: () => toast.error(t('failedToCancelOrder')),
  })

  const rejectGuest = (orderNumber: number) =>
    rejectGuestOrder.mutate({
      path: { orderId: orderNumber },
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
    })

  const confirm = (orderNumber: number) =>
    confirmOrder.mutate({
      body: { orderNumber },
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
    })

  const cancel = (orderNumber: number) =>
    cancelOrder.mutate({
      body: { orderNumber },
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
    })

  // Only the card being acted on shows busy
  const actingOrderNumber = confirmOrder.isPending
    ? toNumber(confirmOrder.variables?.body?.orderNumber)
    : cancelOrder.isPending
      ? toNumber(cancelOrder.variables?.body?.orderNumber)
      : rejectGuestOrder.isPending
        ? toNumber(rejectGuestOrder.variables?.path?.orderId)
        : null

  return { confirm, cancel, rejectGuest, actingOrderNumber }
}
