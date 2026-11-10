/**
 * The sums the page's bill and room clock show: a bill split between the
 * people at a table, and a room's time charged by the rate it ran at.
 */

/** A bill of `total` shared by `people`, in whole pounds: the first shares carry the odd pounds, so they add up */
export function equalSplit(total: number, people: number): number[] {
  const n = Math.max(1, Math.floor(people))
  const base = Math.floor(total / n)
  const odd = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < odd ? 1 : 0))
}

export type BillLine = { id: string; price: number }

/** What the ticked lines come to, and what is left for the others */
export function itemsSplit(lines: BillLine[], mine: ReadonlySet<string>): { share: number; left: number } {
  const share = lines.filter((l) => mine.has(l.id)).reduce((sum, l) => sum + l.price, 0)
  const total = lines.reduce((sum, l) => sum + l.price, 0)
  return { share, left: total - share }
}

export type RateId = 'single' | 'multi'

/** A stretch of a session at one rate */
export type Stretch = { rate: RateId; minutes: number }

export type Tariff = { single: number; multi: number; roundTo: number }

/** The lounge's room on the page: 60 an hour for one or two players, 90 for more, billed by the quarter hour */
export const ROOM_TARIFF: Tariff = { single: 60, multi: 90, roundTo: 15 }

/**
 * A session's time, as the bill shows it: each rate's minutes added up, the
 * whole session rounded up to the tariff's step, and the rounding given to
 * the rate the session ended on
 */
export function sessionBill(stretches: Stretch[], tariff: Tariff): { lines: { rate: RateId; minutes: number; amount: number }[]; total: number } {
  const played = stretches.reduce((sum, s) => sum + s.minutes, 0)
  if (played <= 0) return { lines: [], total: 0 }
  const billed = Math.ceil(played / tariff.roundTo) * tariff.roundTo
  const last = stretches[stretches.length - 1].rate
  const minutes: Record<RateId, number> = { single: 0, multi: 0 }
  for (const s of stretches) minutes[s.rate] += s.minutes
  minutes[last] += billed - played
  const lines = (['single', 'multi'] as const)
    .filter((rate) => minutes[rate] > 0)
    .map((rate) => ({ rate, minutes: minutes[rate], amount: Math.round((minutes[rate] / 60) * tariff[rate]) }))
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) }
}
