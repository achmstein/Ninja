import { type ItemTotal } from '@/api/sales'
import { toNumber } from '@/lib/money'
import { type MenuCostRow } from './menu-cost-rows'

/**
 * Where an item stands on the menu, by how much it sells and how much each
 * sale leaves: a star sells and pays, a plowhorse sells but leaves little,
 * a puzzle pays but does not sell, a dog does neither.
 */
export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog'

export const MENU_CLASSES: MenuClass[] = ['star', 'plowhorse', 'puzzle', 'dog']

/** An item is popular at this share of what an even split would give it */
export const POPULARITY_FACTOR = 0.7

export type MenuEngineeringRow = MenuCostRow & {
  /** Units sold in the window, less the units refunded */
  sold: number
  /** Its share of the units the classified items sold, 0 to 1 */
  mix: number
  /** What its sales left after cost: margin × sold */
  contribution: number
  /** Null when it cannot be placed: no price, or ingredients never costed */
  menuClass: MenuClass | null
}

export type MenuEngineering = {
  rows: MenuEngineeringRow[]
  /** The mix share from which an item counts as popular */
  popularityThreshold: number
  /** The margin from which an item counts as paying: the average, weighted by what sold */
  averageMargin: number
  /** Nothing classified sold in the window: there is nothing to place */
  noSales: boolean
}

/**
 * The menu-engineering matrix over the window's sales (Kasavana and Smith):
 * popular when an item's share of units sold reaches 70% of an even split
 * across the classified items; paying when its margin reaches the average
 * margin weighted by units sold. Only items with a price and every
 * ingredient costed are placed; the rest stay in the list, unplaced, so a
 * lower-bound cost never passes for a real one. The Assistant's
 * get_menu_engineering applies the same rule.
 */
export function toMenuEngineering(
  costRows: MenuCostRow[],
  byItem: ItemTotal[]
): MenuEngineering {
  const sold = new Map<number, number>()
  for (const line of byItem) {
    if (line.catalogItemId == null) continue
    const id = toNumber(line.catalogItemId)
    // Units sold less units refunded: a sale given back did not sell
    const units = line.netQty != null ? line.netQty : line.qty
    sold.set(id, (sold.get(id) ?? 0) + toNumber(units))
  }

  const placeable = (r: MenuCostRow) => r.status === 'ok' || r.status === 'over'
  const classified = costRows.filter(placeable)
  const totalSold = classified.reduce(
    (sum, r) => sum + (sold.get(r.catalogItemId) ?? 0),
    0
  )
  const popularityThreshold =
    classified.length > 0 ? POPULARITY_FACTOR / classified.length : 0
  const averageMargin =
    totalSold > 0
      ? classified.reduce(
          (sum, r) => sum + r.margin * (sold.get(r.catalogItemId) ?? 0),
          0
        ) / totalSold
      : 0
  const noSales = totalSold === 0

  const rows = costRows.map((r): MenuEngineeringRow => {
    const units = sold.get(r.catalogItemId) ?? 0
    const mix = placeable(r) && totalSold > 0 ? units / totalSold : 0
    const popular = mix >= popularityThreshold
    const paying = r.margin >= averageMargin
    return {
      ...r,
      sold: units,
      mix,
      contribution: r.margin * units,
      menuClass:
        !placeable(r) || noSales
          ? null
          : popular
            ? paying
              ? 'star'
              : 'plowhorse'
            : paying
              ? 'puzzle'
              : 'dog',
    }
  })

  // Placed items in matrix order, the biggest earners first within each;
  // the unplaced at the end
  const order = (c: MenuClass | null) =>
    c === null ? MENU_CLASSES.length : MENU_CLASSES.indexOf(c)
  rows.sort(
    (a, b) =>
      order(a.menuClass) - order(b.menuClass) || b.contribution - a.contribution
  )

  return { rows, popularityThreshold, averageMargin, noSales }
}

/** How many items sit in each class */
export function countClasses(rows: MenuEngineeringRow[]) {
  const counts: Record<MenuClass, number> = {
    star: 0,
    plowhorse: 0,
    puzzle: 0,
    dog: 0,
  }
  for (const r of rows) if (r.menuClass) counts[r.menuClass]++
  return counts
}
