import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { v4 as uuidv4 } from 'uuid'
import {
  cancelOrderMutation,
  confirmOrderMutation,
  deleteOrderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'

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

  const deleteOrder = useMutation({
    ...deleteOrderMutation(),
    onSuccess: () => {
      invalidateOrders()
      toast.success(t('orderDeleted'))
    },
    onError: () => toast.error(t('failedToDeleteOrder')),
  })

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

  const remove = (orderNumber: number) =>
    deleteOrder.mutate({
      path: { orderId: orderNumber },
      query: { 'api-version': API_VERSION },
    })

  return {
    confirm,
    cancel,
    remove,
    isActing:
      confirmOrder.isPending || cancelOrder.isPending || deleteOrder.isPending,
  }
}
