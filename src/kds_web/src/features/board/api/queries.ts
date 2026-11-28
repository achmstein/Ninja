import { getKitchenOrdersOptions, getKitchenStationsOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'

/**
 * What the board reads from the server, and the keys it is cached under (the
 * plan's data layer: components never name a generated function). The board
 * polls as a fallback only, and briefly, because a card that is not there yet is
 * a customer waiting; the hub (use-kitchen-notifications) is the primary path.
 */
export const boardQueries = {
  /** The kitchen's queue at the active branch; on a station's screen only its part */
  orders: (stationId: number | null) => ({
    ...getKitchenOrdersOptions({ query: stationId != null ? { stationId } : undefined }),
    refetchInterval: 20_000,
  }),

  /** The branch's stations */
  stations: () => ({
    ...getKitchenStationsOptions(),
    staleTime: 60_000,
  }),
}

/** Every copy of the board, whichever station it is for: what a change makes stale */
export const BOARD_KEY = [{ _id: 'getKitchenOrders' }]
