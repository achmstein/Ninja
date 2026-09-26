import { type PayLineView, type PayOptionsView } from '@/api/sales'

/**
 * Online payments (docs/online-payments-plan.md), the arithmetic the guest's
 * phone shows before it asks the server: what a share comes to, the fee
 * when the café passes the provider's on, and the tip. Each one mirrors
 * Sales' OnlineShares, so the summary the guest confirms is the amount the
 * server charges; the server decides in the end all the same.
 */

/** How the server takes a share: the SplitMode enum's numbers. */
export const SPLIT = { full: 0, items: 1, equal: 2, custom: 3 } as const
export type SplitKind = keyof typeof SPLIT

/** The most people an equal split divides by (OnlineShares.MaxParts). */
export const MAX_PARTS = 50

/** Two decimals, halves away from zero, like the server's Money. The nudge
 *  keeps a float's 1.005 (really 1.00499…) rounding up as the decimal does. */
export function money(value: number): number {
  const cents = Math.round(Math.abs(value) * 100 + 1e-7)
  return (Math.sign(value) * cents) / 100 || 0
}

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0

/**
 * The guest's fee on a share when the café passes the provider's fee on:
 * solved so that what the provider keeps (a percentage of the charge plus
 * a fixed part) is what the fee covers. Zero when the café absorbs it.
 */
export function guestFee(amountAndTip: number, percent: number, fixedFee: number): number {
  if (amountAndTip <= 0 || (percent <= 0 && fixedFee <= 0)) return 0
  const rate = percent / 100
  if (rate >= 1) return 0
  const charged = (amountAndTip + fixedFee) / (1 - rate)
  return money(charged - amountAndTip)
}

/** Paying `parts` of `of` equal parts: rounding leaves a piaster or two on
 *  the last share, and whoever pays it pays them. Never past what is left. */
export function equalShare(total: number, remaining: number, parts: number, of: number): number {
  if (remaining <= 0 || of < 1 || parts < 1) return 0
  let amount = money((total * parts) / of)
  if (remaining - amount < 0.05) amount = remaining
  return Math.min(amount, remaining)
}

/** The lines picked, at their share of the total; the last free lines take
 *  whatever is left with them, rounding and all. */
export function itemsShare(lines: PayLineView[], picked: ReadonlySet<string>, remaining: number): number {
  const chosen = lines.filter((line) => picked.has(String(line.id)) && !line.claimed)
  if (chosen.length === 0 || remaining <= 0) return 0
  const amount = Math.min(money(chosen.reduce((sum, line) => sum + num(line.share), 0)), remaining)
  const othersFree = lines.some((line) => !line.claimed && !picked.has(String(line.id)) && num(line.total) !== 0)
  return othersFree ? amount : remaining
}

/** A typed amount, as the server would take it: two decimals, or nothing
 *  when it is not a positive number. Past what is left is the caller's
 *  to refuse. */
export function customShare(text: string): number {
  const value = Number(text.replace(',', '.').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  return Number.isFinite(value) && value > 0 ? money(value) : 0
}

/** A tip chip's amount on a share. */
export function tipFor(share: number, percent: number): number {
  return percent > 0 ? money((share * percent) / 100) : 0
}

export type PaySummary = {
  share: number
  tip: number
  /** The provider's fee the guest pays; 0 when the café absorbs it */
  fee: number
  /** What the card is charged */
  total: number
}

/** The confirm button's arithmetic: the share, the tip, and the fee on both. */
export function paySummary(share: number, tip: number, options: PayOptionsView): PaySummary {
  const base = money(share + tip)
  const fee =
    options.feeMode === 'Guest'
      ? guestFee(base, num(options.feePercent), num(options.feeFixed))
      : 0
  return { share, tip, fee, total: money(base + fee) }
}

/** Why a bill cannot be paid now, as the server says it; each has a line
 *  of its own. "off" and "not-set-up" mean the café does not take payments
 *  at the table, which the guest is not told about. */
export const PAY_WHY = [
  'off',
  'not-set-up',
  'closed',
  'clock-running',
  'empty',
  'paid',
  'being-paid',
] as const
export type PayWhy = (typeof PAY_WHY)[number]

export const offersPay = (why: string | null | undefined) =>
  why !== 'off' && why !== 'not-set-up'

/** How many equal parts to start from: the room's party where the bill
 *  knows it, else two. */
export function defaultParts(people: number | string | null | undefined): number {
  const n = Math.round(num(people))
  return n >= 2 ? Math.min(n, MAX_PARTS) : 2
}
