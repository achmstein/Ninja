import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setOrderPreparationMutation } from '@/api/ordering/@tanstack/react-query.gen'
import type { KitchenOrder, PreparationStatus } from '@/api/ordering/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

const BOARD_KEY = [{ _id: 'getKitchenOrders' }]

/**
 * Start / Ready / Recall, the one call the kitchen makes. Each carries a
 * fresh idempotency key: a double tap on a slow connection must not turn
 * into two commands (the backend treats a repeat as a no-op anyway).
 *
 * The card moves lanes the instant it is tapped — optimistic, because a
 * barista with a hot cup in one hand does not wait for a round trip — and
 * the board refetches once the server has spoken, whichever way.
 */
export function usePreparation() {
  const t = useT()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    ...setOrderPreparationMutation(),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY })
      const orderNumber = Number(variables.path?.orderId)
      const target = variables.body?.preparation
      const previous = queryClient.getQueriesData<KitchenOrder[]>({
        queryKey: BOARD_KEY,
      })
      const nowIso = new Date().toISOString()
      queryClient.setQueriesData<KitchenOrder[]>({ queryKey: BOARD_KEY }, (old) =>
        old?.map((order) =>
          Number(order.orderNumber) === orderNumber
            ? {
                ...order,
                preparation: target,
                preparingAt:
                  target === 'Preparing'
                    ? (order.preparingAt ?? nowIso)
                    : order.preparingAt,
                readyAt: target === 'Ready' ? nowIso : null,
              }
            : order
        )
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
      toast.error(t('failedToUpdate'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOARD_KEY })
    },
  })

  const setPreparation = (orderNumber: number, preparation: PreparationStatus) =>
    mutation.mutate({
      path: { orderId: orderNumber },
      body: { preparation },
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
    })

  // Only the card being acted on shows busy
  const actingOrderNumber = mutation.isPending
    ? Number(mutation.variables?.path?.orderId)
    : null

  return { setPreparation, actingOrderNumber }
}
