import type { CatalogItemDto } from '@/api/catalog'
import { effectiveBasePrice } from '@/components/menu/item-form'
import type { CartLine } from '@/lib/cart'

/** What became of the order on its way to another branch */
export type OrderMove = {
  lines: CartLine[]
  /** Not served there: the dish, or one of its options, is off that branch's menu or sold out */
  dropped: CartLine[]
  /** Kept, at that branch's price */
  repriced: { line: CartLine; from: number; to: number }[]
}

/**
 * The order taken to another branch's menu. The menu is the business's
 * own everywhere; a branch only prices a dish its own way or does not serve
 * it (and sells out an option). So each line stays as the customer made it,
 * at the price there, and a line that cannot be had there goes. The
 * options' own prices are the business's, the same at every branch.
 */
export function moveLines(lines: CartLine[], menu: CatalogItemDto[]): OrderMove {
  const byId = new Map(menu.map((item) => [Number(item.id), item]))
  const kept: CartLine[] = []
  const dropped: CartLine[] = []
  const repriced: OrderMove['repriced'] = []

  for (const line of lines) {
    const item = byId.get(line.productId)
    if (!item || item.isAvailable === false || item.isOutOfStock) {
      dropped.push(line)
      continue
    }
    const options = new Map((item.customizations ?? []).flatMap((c) => c.options ?? []).map((o) => [Number(o.id), o]))
    const missing = line.customizations.some((c) => {
      const option = options.get(c.optionId)
      return !option || option.isOutOfStock
    })
    if (missing) {
      dropped.push(line)
      continue
    }
    const price = round(effectiveBasePrice(item) + line.customizations.reduce((sum, c) => sum + c.priceAdjustment, 0))
    if (Math.abs(price - line.price) > 0.004) {
      const moved = { ...line, price }
      repriced.push({ line: moved, from: line.price, to: price })
      kept.push(moved)
    } else {
      kept.push(line)
    }
  }
  return { lines: kept, dropped, repriced }
}

const round = (value: number) => Math.round(value * 100) / 100
