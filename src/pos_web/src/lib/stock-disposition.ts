/** What becomes of a confirmed order's food once it will never be sold */
export type StockDisposition = 'Waste' | 'Restock'

/**
 * What the till offers first when it cancels or voids: waste once the food
 * was made (the kitchen marked it ready, or it went out with a rider), back
 * to stock when it never was. The cashier confirms or changes it.
 */
export function defaultDisposition(prepared: boolean | null | undefined): StockDisposition {
  return prepared ? 'Waste' : 'Restock'
}

/** A bill's orders: waste if any of them was made, since the bill goes as one */
export function defaultDispositionFor(prepared: ReadonlyArray<boolean | null | undefined>): StockDisposition {
  return defaultDisposition(prepared.some(Boolean))
}

/** The orders a bill holds, each once: only an order took stock, never a manual line */
export function orderIdsOn(lines: ReadonlyArray<{ orderId?: number | string | null }>): number[] {
  return [...new Set(lines.flatMap((l) => (l.orderId == null ? [] : [Number(l.orderId)])))]
}
