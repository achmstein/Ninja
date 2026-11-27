/**
 * The amounts one tap offers: exactly what their items come to, then the round
 * sums above it. For an amount on account, the round sums alone.
 */
export function partAmounts(items: number): number[] {
  if (items <= 0) return [50, 100, 200]
  return [...new Set([items, ...[100, 200].map((step) => Math.floor(items / step) * step + step)])]
}

/**
 * What stands in the way of taking this amount, if anything. Somebody pays at
 * least for what they had. And on a bill whose time is all on it, a part is
 * less than the whole: paying all that is left is the bill's own payment,
 * which closes it. A room whose clock still runs has more to come, so there
 * any amount is taken.
 */
export function partAmountProblem(amount: number, items: number, left: number, clockRunning: boolean): 'none' | 'empty' | 'belowItems' | 'paysAll' {
  if (!(amount > 0)) return 'empty'
  if (amount < items) return 'belowItems'
  if (!clockRunning && amount >= left) return 'paysAll'
  return 'none'
}
