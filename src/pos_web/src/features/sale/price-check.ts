import type { PriceCheckLine, PriceCheckResult } from '@/api/catalog/types.gen'
import { toNumber } from '@/lib/money'
import { lineKey, type SaleLine } from './cart'

/** One thing that differs at the other branch, as the review lists it */
export type PriceReviewItem =
  | { kind: 'changed'; key: string; line: SaleLine; from: number; to: number }
  | { kind: 'soldOut'; key: string; line: SaleLine }
  | { kind: 'optionsOut'; key: string; line: SaleLine; optionIds: number[] }

/**
 * The cart as the other branch would make it: what differs there, and the
 * lines to send at its prices with what it cannot make taken off.
 */
export type PriceReview = {
  items: PriceReviewItem[]
  lines: SaleLine[]
}

/** The cart's lines as the check reads them: each one's unit price with its options, as the order carries it */
export function priceCheckLines(lines: SaleLine[]): PriceCheckLine[] {
  return lines.map((line) => ({
    itemId: line.productId,
    optionIds: line.customizations.map((c) => c.optionId),
    unitPrice: line.price,
  }))
}

/**
 * Reads the other branch's answer against the cart, line by line (the answer
 * comes back in the order the lines were sent). A line it cannot make, the
 * item or one of its choices, is listed and left out; one it prices otherwise
 * is listed and sent at its price. An empty list means the cart goes as it is.
 */
export function reviewPriceCheck(lines: SaleLine[], results: PriceCheckResult[]): PriceReview {
  const items: PriceReviewItem[] = []
  const kept: SaleLine[] = []
  lines.forEach((line, i) => {
    const result = results[i]
    const key = lineKey(line)
    if (!result || !result.available || result.outOfStock) {
      items.push({ kind: 'soldOut', key, line })
      return
    }
    const optionsOut = (result.soldOutOptionIds ?? []).map(toNumber)
    if (optionsOut.length > 0) {
      items.push({ kind: 'optionsOut', key, line, optionIds: optionsOut })
      return
    }
    const price = toNumber(result.price)
    if (result.changed) {
      items.push({ kind: 'changed', key, line, from: line.price, to: price })
      kept.push({ ...line, price })
      return
    }
    kept.push(line)
  })
  return { items, lines: kept }
}
