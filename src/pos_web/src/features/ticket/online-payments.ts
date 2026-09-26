import type { OnlinePaymentView } from '@/api/sales/types.gen'
import { toNumber } from '@/lib/money'

/**
 * Where a bill stands against what guests paid from their phones (pay at
 * table). A payment's `amount` is its share of the bill; its fee and tip
 * ride on top and never reduce what is left. Only a Paid one counts: a
 * Pending one is a guest still at the provider's checkout, a Refunded one
 * went back.
 */
export type OnlineSummary = {
  /** The bill shares guests have paid. */
  paid: number
  /** Tips on top of those, shown apart: not part of the bill. */
  tips: number
  /** Some guest is at the checkout right now: the bill must wait. */
  pending: boolean
  /** What the till still has to take: the total less what is paid online. */
  remaining: number
  /** Paid online covers the bill: it settles itself on the server. */
  covered: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function onlineSummary(
  total: number | string | null | undefined,
  payments: readonly Pick<OnlinePaymentView, 'amount' | 'tip' | 'status'>[] | null | undefined
): OnlineSummary {
  const list = payments ?? []
  const paidOnes = list.filter((p) => p.status === 'Paid')
  const paid = round2(paidOnes.reduce((sum, p) => sum + toNumber(p.amount), 0))
  const tips = round2(paidOnes.reduce((sum, p) => sum + toNumber(p.tip), 0))
  const pending = list.some((p) => p.status === 'Pending')
  const billTotal = toNumber(total)
  const remaining = Math.max(0, round2(billTotal - paid))
  return {
    paid,
    tips,
    pending,
    remaining,
    covered: paid > 0 && remaining <= 0,
  }
}

/**
 * Whether the till can settle: nobody mid-checkout, and the tenders taken
 * cover what is left after the online payments. With nothing left the till
 * may still settle with no tender at all (the server adds the online ones),
 * for the rare bill that could not settle itself.
 */
export function canSettleWith(
  summary: Pick<OnlineSummary, 'pending' | 'remaining'>,
  tendered: number,
  tenderCount: number
): boolean {
  if (summary.pending) return false
  if (summary.remaining <= 0) return true
  return tenderCount > 0 && round2(tendered) >= summary.remaining
}
