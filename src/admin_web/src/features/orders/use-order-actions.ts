import { useMutation, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import {
  cancelOrderMutation,
  confirmOrderMutation,
  deleteOrderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

// Confirm/cancel with idempotency keys + query invalidation, shared by the
// orders table, the live board, and the detail sheet.
export function useOrderActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllOrders' }] })
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

  // No onSuccess/onError here: single and bulk delete toast differently
  const deleteOrder = useMutation({ ...deleteOrderMutation() })

  const confirm = (orderNumber: number) =>
    confirmOrder.mutate({
      body: { orderNumber },
      headers: { 'x-requestid': uuidv4() },
      query: { 'api-version': API_VERSION },
    })

  const cancel = (orderNumber: number) =>
    cancelOrder.mutate({
      body: { orderNumber },
      headers: { 'x-requestid': uuidv4() },
      query: { 'api-version': API_VERSION },
    })

  const remove = async (orderNumber: number) => {
    try {
      await deleteOrder.mutateAsync({
        path: { orderId: orderNumber },
        query: { 'api-version': API_VERSION },
      })
      invalidateOrders()
      toast.success(t('orderDeleted'))
    } catch {
      toast.error(t('failedToDeleteOrder'))
    }
  }

  const removeMany = async (orderNumbers: number[]) => {
    const results = await Promise.allSettled(
      orderNumbers.map((orderNumber) =>
        deleteOrder.mutateAsync({
          path: { orderId: orderNumber },
          query: { 'api-version': API_VERSION },
        })
      )
    )
    invalidateOrders()
    if (results.some((r) => r.status === 'rejected')) {
      toast.error(t('failedToDeleteOrders'))
    } else {
      toast.success(t('ordersDeleted', { count: orderNumbers.length }))
    }
  }

  // The order a confirm/cancel is currently in flight for — lets the live
  // board mark only the touched card as busy instead of all of them
  const actingOrderNumber = confirmOrder.isPending
    ? confirmOrder.variables?.body?.orderNumber
    : cancelOrder.isPending
      ? cancelOrder.variables?.body?.orderNumber
      : undefined

  return {
    confirm,
    cancel,
    remove,
    removeMany,
    actingOrderNumber,
    isActing:
      confirmOrder.isPending || cancelOrder.isPending || deleteOrder.isPending,
  }
}
