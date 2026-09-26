import { type PayLineView, type PayOptionsView } from '@/api/sales'

/**
 * Online payments (docs/online-payments-plan.md), the arithmetic the guest's
 * phone shows before it asks the server: what a share comes to and the
 * fee when the café passes the provider's on. Each one mirrors
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
export function guestFee(share: number, percent: number, fixedFee: number): number {
  if (share <= 0 || (percent <= 0 && fixedFee <= 0)) return 0
  const rate = percent / 100
  if (rate >= 1) return 0
  const charged = (share + fixedFee) / (1 - rate)
  return money(charged - share)
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

export type PaySummary = {
  share: number
  /** The provider's fee the guest pays; 0 when the café absorbs it */
  fee: number
  /** What the card is charged */
  total: number
}

/** The confirm button's arithmetic: the share and the fee on it. */
export function paySummary(share: number, options: PayOptionsView): PaySummary {
  const fee =
    options.feeMode === 'Guest'
      ? guestFee(share, num(options.feePercent), num(options.feeFixed))
      : 0
  return { share, fee, total: money(share + fee) }
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

/** The table the equal split draws: two seats at least, a dozen at most. */
export const MIN_SEATS = 2
export const MAX_SEATS = 12

const clampSeats = (n: number) => Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.round(n)))

/**
 * The fewest seats the table can show: everyone who has paid or is paying
 * has a seat of their own, and the guest one more.
 */
export function minSeats(sharesTaken: number): number {
  return clampSeats(Math.max(MIN_SEATS, sharesTaken + 1))
}

/** How many seats the table starts with: the room's party where the bill
 *  knows it, else two, and never fewer than {@link minSeats}. */
export function startSeats(people: number | string | null | undefined, sharesTaken: number): number {
  return Math.max(clampSeats(defaultParts(people)), minSeats(sharesTaken))
}

export type SeatPlan = {
  /** The bill's total over the seats */
  perPerson: number
  /** Seats that look paid for: an estimate from the money, not a record */
  paid: number
  /** Seats that look like someone is paying them right now */
  held: number
  /** Seats the guest can take; one at least */
  free: number
}

/**
 * How the drawn table fills: what is paid and what is being paid, in whole
 * seats at the per-person price. Only a picture: shares paid by items or
 * by amount do not come in seats, and the guest always keeps one.
 */
export function seatPlan(total: number, paid: number, held: number, seats: number): SeatPlan {
  const n = Math.max(1, Math.round(seats))
  const perPerson = n > 0 ? money(total / n) : 0
  const whole = (v: number) => (perPerson > 0 ? Math.round(Math.max(0, v) / perPerson) : 0)
  const paidSeats = Math.min(n - 1, whole(paid))
  const heldSeats = Math.min(n - 1 - paidSeats, whole(held))
  return { perPerson, paid: paidSeats, held: heldSeats, free: n - paidSeats - heldSeats }
}

/** The seats the guest picked that are still free at this size of table,
 *  in order; one at least, their own (the first). */
export function pickedSeats(selected: ReadonlySet<number>, free: number): number[] {
  const kept = [...selected].filter((i) => i >= 0 && i < free).sort((a, b) => a - b)
  return kept.length > 0 ? kept : [0]
}

/**
 * The custom amount's slider moves in whole steps, 1 for small bills and 5
 * past 200, and its last step is exactly what is left, piasters and all.
 */
export function sliderStep(remaining: number): number {
  return remaining > 200 ? 5 : 1
}

/** How many steps the slider has, the last one landing on what is left. */
export function sliderSteps(remaining: number): number {
  return remaining > 0 ? Math.ceil(remaining / sliderStep(remaining) - 1e-9) : 0
}

/** The amount at a slider step. */
export function sliderAmount(step: number, remaining: number): number {
  const last = sliderSteps(remaining)
  if (step >= last) return money(Math.max(0, remaining))
  return Math.max(0, step) * sliderStep(remaining)
}

/** The slider step nearest to an amount. */
export function sliderPosition(amount: number, remaining: number): number {
  if (remaining <= 0 || amount <= 0) return 0
  if (amount >= remaining) return sliderSteps(remaining)
  return Math.min(sliderSteps(remaining), Math.round(amount / sliderStep(remaining)))
}

export type QuickAmount = { key: string; label: string | null; amount: number }

/**
 * The custom amount's chips: a quarter, a third, a half and all of what is
 * left, then up to three round sums below it, the largest that fit.
 */
export function quickAmounts(remaining: number): QuickAmount[] {
  if (remaining <= 0) return []
  const fractions: QuickAmount[] = [
    { key: 'quarter', label: '¼', amount: money(remaining / 4) },
    { key: 'third', label: '⅓', amount: money(remaining / 3) },
    { key: 'half', label: '½', amount: money(remaining / 2) },
    { key: 'all', label: null, amount: money(remaining) },
  ]
  const rounds = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
    .filter((v) => v < remaining && !fractions.some((f) => f.amount === v))
    .slice(-3)
    .map((v): QuickAmount => ({ key: String(v), label: null, amount: v }))
  return [...fractions, ...rounds]
}
