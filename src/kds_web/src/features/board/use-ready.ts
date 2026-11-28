import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { KitchenOrder } from '@ninja/api/ordering/types.gen'
import { useT } from '@/lib/i18n'
import { serverNow } from '@/lib/server-clock'
import { toast } from '@/lib/toast'
import { sendReady } from './api/mutations'
import { BOARD_KEY } from './api/queries'
import { useStation } from './use-station'

type ReadyVariables = { orderNumber: number; ready: boolean }

/**
 * Ready / Bring back, the one call the kitchen makes (api/mutations.ts).
 *
 * The card leaves the board the instant it is tapped — optimistic, because
 * a barista with a hot cup in one hand does not wait for a round trip — and
 * the board refetches once the server has spoken, whichever way.
 */
export function useReady() {
  const t = useT()
  const queryClient = useQueryClient()
  const { stationId } = useStation()

  const mutation = useMutation({
    mutationFn: ({ orderNumber, ready }: ReadyVariables) => sendReady(orderNumber, ready, stationId),
    onMutate: async ({ orderNumber, ready }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY })
      const previous = queryClient.getQueriesData<KitchenOrder[]>({
        queryKey: BOARD_KEY,
      })
      const nowIso = new Date(serverNow()).toISOString()
      queryClient.setQueriesData<KitchenOrder[]>({ queryKey: BOARD_KEY }, (old) =>
        old?.map((order) =>
          Number(order.orderNumber) === orderNumber ? { ...order, readyAt: ready ? nowIso : null } : order
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

  const setReady = (orderNumber: number, ready: boolean) => mutation.mutate({ orderNumber, ready })

  // Only the card being acted on shows busy
  const actingOrderNumber = mutation.isPending ? (mutation.variables?.orderNumber ?? null) : null

  return { setReady, actingOrderNumber }
}
