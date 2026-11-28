import { type StockLevelView } from '@ninja/api/inventory'
import { toNumber } from '@/lib/money'

/** What the stock list can be sorted by. */
export type StockSort = 'low' | 'daysLeft' | 'value' | 'name'

export const stockSorts = ['low', 'daysLeft', 'value', 'name'] as const satisfies readonly StockSort[]

/**
 * How many days what is on the shelf lasts at the rate the branch has been
 * using it; null when it has not been using any (nothing to go by).
 */
export function daysLeft(level: StockLevelView): number | null {
  const perDay = toNumber(level.dailyUse)
  if (!(perDay > 0)) return null
  return Math.max(0, toNumber(level.onHand)) / perDay
}

/**
 * The levels in the order asked for. Retired items are always last; under
 * each order, ties go by name. Low first is the items at or under their
 * reorder level, then the rest; fewest days left puts items with no use to
 * go by after those with.
 */
export function sortLevels(
  levels: StockLevelView[],
  sort: StockSort,
  nameOf: (level: StockLevelView) => string
): StockLevelView[] {
  const byName = (a: StockLevelView, b: StockLevelView) =>
    nameOf(a).localeCompare(nameOf(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  const order: Record<StockSort, (a: StockLevelView, b: StockLevelView) => number> = {
    name: () => 0,
    low: (a, b) => Number(b.isLow) - Number(a.isLow),
    value: (a, b) => toNumber(b.value) - toNumber(a.value),
    daysLeft: (a, b) => (daysLeft(a) ?? Infinity) - (daysLeft(b) ?? Infinity) || 0,
  }
  return [...levels].sort((a, b) => Number(b.isActive) - Number(a.isActive) || order[sort](a, b) || byName(a, b))
}
