import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toNumber } from '@/lib/money'
import { stockLevelsQueryOptions } from './queries'

/**
 * What the active branch last paid per base unit, by stock item id, off
 * the levels list; the receive forms show it under a line's unit cost.
 */
export function useLastCosts(): Map<number, number> {
  const levels = useQuery(stockLevelsQueryOptions({ includeRetired: true }))
  return useMemo(
    () =>
      new Map(
        (levels.data ?? [])
          .filter((l) => l.lastCost != null)
          .map((l) => [toNumber(l.stockItemId), toNumber(l.lastCost)])
      ),
    [levels.data]
  )
}
