import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setOrderReady, setOrderStationReady } from '@/api/ordering/sdk.gen'
import type { KitchenOrder } from '@/api/ordering/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { useStation } from './use-station'

const BOARD_KEY = [{ _id: 'getKitchenOrders' }]

type ReadyVariables = { orderNumber: number; ready: boolean }

/**
 * Ready / Bring back, the one call the kitchen makes: for this station's
 * part on a station's screen, for the whole order on the pass. Each
 * carries a fresh idempotency key: a double tap on a slow connection must not turn into two
 * commands (the backend treats a repeat as a no-op anyway).
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
    mutationFn: async ({ orderNumber, ready }: ReadyVariables) => {
      const common = {
        body: { ready },
        headers: { 'x-requestid': crypto.randomUUID() },
        query: { 'api-version': API_VERSION },
        throwOnError: true,
      } as const
      if (stationId != null) {
        await setOrderStationReady({ ...common, path: { orderId: orderNumber, stationId } })
      } else {
        await setOrderReady({ ...common, path: { orderId: orderNumber } })
      }
    },
    onMutate: async ({ orderNumber, ready }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY })
      const previous = queryClient.getQueriesData<KitchenOrder[]>({
        queryKey: BOARD_KEY,
      })
      const nowIso = new Date().toISOString()
      queryClient.setQueriesData<KitchenOrder[]>({ queryKey: BOARD_KEY }, (old) =>
        old?.map((order) =>
          Number(order.orderNumber) === orderNumber
            ? { ...order, readyAt: ready ? nowIso : null }
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

  const setReady = (orderNumber: number, ready: boolean) =>
    mutation.mutate({ orderNumber, ready })

  // Only the card being acted on shows busy
  const actingOrderNumber = mutation.isPending
    ? (mutation.variables?.orderNumber ?? null)
    : null

  return { setReady, actingOrderNumber }
}
