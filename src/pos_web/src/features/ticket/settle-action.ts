/**
 * What the payment page's one button does, from the way of paying picked,
 * the amount typed and what is still owed. The button says it before the tap,
 * so there is nothing to work out: it takes the rest and closes the bill, or
 * adds one payment of several, or closes a bill with nothing left to take.
 */
export type SettleAction =
  /** Nothing left to take: the bill is closed as it stands */
  | { kind: 'settle' }
  /** Less than what is left: one payment of several, the bill staying to be paid */
  | { kind: 'add'; amount: number }
  /** The rest, which closes the bill. Cash may be more than the rest: the change is handed back */
  | { kind: 'take'; amount: number }
  /** Nothing to do yet: a tab with no amount typed, or a nought */
  | { kind: 'none' }

/**
 * @param entered What was typed; null when nothing was, which means all that
 *   is left (never for a tab: what goes on account is typed, share by share)
 */
export function settleAction(tenderName: string, entered: number | null, remaining: number): SettleAction {
  if (remaining <= 0) return { kind: 'settle' }
  if (entered === null) return tenderName === 'Account' ? { kind: 'none' } : { kind: 'take', amount: remaining }
  if (!Number.isFinite(entered) || entered <= 0) return { kind: 'none' }
  if (entered < remaining) return { kind: 'add', amount: entered }
  // Only cash goes past what is owed; a card, InstaPay or a tab takes exactly the rest
  return { kind: 'take', amount: tenderName === 'Cash' ? entered : remaining }
}

/**
 * The notes a customer is likely to hand over in cash for what is left: what
 * it rounds up to, each once. Never the exact amount itself: that is what is
 * taken with nothing typed, so a button for it would only repeat the amount.
 */
export function cashNotes(remaining: number): number[] {
  if (remaining <= 0) return []
  return [...new Set([50, 100, 200, 500].map((step) => Math.ceil(remaining / step) * step))].filter((note) => note > remaining)
}
