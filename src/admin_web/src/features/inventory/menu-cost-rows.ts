import { type CatalogItemDto } from '@/api/catalog'
import { type RecipeCostView } from '@/api/inventory'
import { toNumber } from '@/lib/money'

/** Food cost above this share of the price is flagged unless the page says otherwise */
export const DEFAULT_FOOD_COST_TARGET = 35

/** One tracked menu item with Catalog's price beside Inventory's cost */
export type MenuCostRow = {
  catalogItemId: number
  name: CatalogItemDto['name']
  category: CatalogItemDto['catalogTypeName']
  price: number
  cost: number
  margin: number
  /** cost ÷ price, as a whole percent; null without a price */
  foodCost: number | null
  /** Ingredients never received at the branch: the cost is a lower bound */
  uncosted: number
  optionExtras: number
  status: 'ok' | 'over' | 'incomplete' | 'unpriced'
}

/**
 * Join the branch's recipe costs with the menu's prices. Items with a
 * recipe but no menu entry any more are dropped; the food-cost target
 * decides which rows are flagged.
 */
export function toMenuCostRows(
  costs: RecipeCostView[],
  items: CatalogItemDto[],
  target: number
): MenuCostRow[] {
  const byId = new Map(items.map((item) => [toNumber(item.id), item]))
  const rows: MenuCostRow[] = []
  for (const c of costs) {
    const item = byId.get(toNumber(c.catalogItemId))
    if (!item) continue
    const price = toNumber(item.price)
    const cost = toNumber(c.baseCost)
    const foodCost = price > 0 ? Math.round((cost / price) * 100) : null
    const uncosted = c.uncosted.length
    rows.push({
      catalogItemId: toNumber(c.catalogItemId),
      name: item.name,
      category: item.catalogTypeName,
      price,
      cost,
      margin: price - cost,
      foodCost,
      uncosted,
      optionExtras: c.options.length,
      status:
        price <= 0
          ? 'unpriced'
          : uncosted > 0
            ? 'incomplete'
            : foodCost !== null && foodCost > target
              ? 'over'
              : 'ok',
    })
  }
  // The worst food cost first; incomplete ones among them by their lower bound
  return rows.sort(
    (a, b) =>
      (b.foodCost ?? -1) - (a.foodCost ?? -1) ||
      (a.name?.en ?? '').localeCompare(b.name?.en ?? '')
  )
}

/** The page's headline figures */
export function summarize(rows: MenuCostRow[], target: number) {
  const priced = rows.filter((r) => r.foodCost !== null)
  const revenue = priced.reduce((sum, r) => sum + r.price, 0)
  const cost = priced.reduce((sum, r) => sum + r.cost, 0)
  return {
    tracked: rows.length,
    over: rows.filter((r) => r.status === 'over').length,
    incomplete: rows.filter((r) => r.status === 'incomplete').length,
    /** Cost over price across the priced items, as if one of each were sold */
    averageFoodCost: revenue > 0 ? Math.round((cost / revenue) * 100) : null,
    target,
  }
}
