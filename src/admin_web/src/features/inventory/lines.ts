// One line of a delivery as the receive form keeps it: strings straight
// from the inputs, with the pricing arithmetic that keeps quantity, unit
// cost and total in step. Shared by the receive form and the receipt
// review sheet, which hands lines over in this shape.

/** The numbers on a line, as typed */
export type Amounts = {
  /** Base-unit quantity, what is actually posted */
  quantity: string
  /** Pack count the user typed, only for items with a pack size */
  packs: string
  unitCost: string
  /** Line total as typed or derived; the invoice usually shows this, not the unit cost */
  total: string
  /** Which of the two the user typed last: the other one is derived from it */
  priced: 'unit' | 'total'
}

export type Line = Amounts & {
  key: number
  stockItemId: string | null
}

let lineKey = 0
export const newLine = (): Line => ({
  key: lineKey++,
  stockItemId: null,
  quantity: '',
  packs: '',
  unitCost: '',
  total: '',
  priced: 'unit',
})

export const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '')
export const perUnit = (n: number) =>
  Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : ''

/**
 * Keep quantity, unit cost and total consistent whichever one changed:
 * typing the invoice total gives the unit cost, typing a unit cost gives the
 * total, and a new quantity re-derives whichever the user did not type.
 */
export function reprice(
  line: Amounts,
  patch: Partial<Amounts>
): Partial<Amounts> {
  const next = { ...line, ...patch }
  const qty = parseFloat(next.quantity)

  if ('total' in patch) {
    const total = parseFloat(next.total)
    return {
      ...patch,
      priced: 'total',
      unitCost: qty > 0 && total >= 0 ? perUnit(total / qty) : next.unitCost,
    }
  }

  if ('unitCost' in patch) {
    const cost = parseFloat(next.unitCost)
    return {
      ...patch,
      priced: 'unit',
      total: qty > 0 && cost >= 0 ? money(qty * cost) : '',
    }
  }

  // Quantity (or packs) changed: hold what was typed, derive the other
  if (next.priced === 'total') {
    const total = parseFloat(next.total)
    return {
      ...patch,
      unitCost: qty > 0 && total >= 0 ? perUnit(total / qty) : '',
    }
  }

  const cost = parseFloat(next.unitCost)
  return { ...patch, total: qty > 0 && cost >= 0 ? money(qty * cost) : '' }
}

/** A line has an item, a quantity and a cost: what the API needs to post it */
export function isComplete(line: Line): boolean {
  return (
    !!line.stockItemId &&
    parseFloat(line.quantity) > 0 &&
    parseFloat(line.unitCost) >= 0 &&
    line.unitCost !== ''
  )
}
