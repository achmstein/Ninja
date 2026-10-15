import { type DailySales } from '@/api/sales'
import {
  businessDateOf,
  businessDaysWindow,
  previousWindow,
  type BusinessHours,
  type DayWindow,
} from '@/lib/business-day'
import { toNumber } from '@/lib/money'
import { addDays, plainDateKey, type PlainDate } from '@/lib/zoned-time'

export type TrendWindows = {
  /** The first business day shown, and the first of the period compared with */
  first: PlainDate
  previousFirst: PlainDate
  current: DayWindow
  /** The days before, cut to the same elapsed time while today is still going */
  previous: DayWindow
}

const FIVE_MINUTES = 300_000

/**
 * The chart's two windows: the last `days` business days ending with today's
 * (in the business's zone, from the branch's day start), and as many days
 * right before them, up to the same time into today's twin so a partial
 * today is compared with a partial day. The cut is to the five minutes, so
 * the query is not asked for again on every tick.
 */
export function trendWindows(
  now: Date,
  hours: BusinessHours,
  days: number
): TrendWindows {
  const today = businessDateOf(now, hours)
  const first = addDays(today, -(days - 1))
  const current = businessDaysWindow(first, today, hours)
  const before = previousWindow(current, hours, now)
  const span =
    Math.floor((before.to.getTime() - before.from.getTime()) / FIVE_MINUTES) *
    FIVE_MINUTES
  return {
    first,
    previousFirst: addDays(first, -days),
    current,
    previous: { from: before.from, to: new Date(before.from.getTime() + span) },
  }
}

export type TrendRow = {
  date: string
  revenue: number
  tickets: number
  previous: number
}

/**
 * One row per business day, each with its twin from the period before:
 * net sales (gross less the refunds given that day) and the bills settled.
 * The daily report lists empty days too; a day it did not list reads zero.
 */
export function trendRows(
  windows: Pick<TrendWindows, 'first' | 'previousFirst'>,
  days: number,
  current: DailySales[] | undefined,
  previous: DailySales[] | undefined
): TrendRow[] {
  const byDay = (list: DailySales[] | undefined) =>
    new Map((list ?? []).map((d) => [d.date.slice(0, 10), d]))
  const now = byDay(current)
  const before = byDay(previous)
  return Array.from({ length: days }, (_, i) => {
    const key = plainDateKey(addDays(windows.first, i))
    const twin = plainDateKey(addDays(windows.previousFirst, i))
    const row = now.get(key)
    return {
      date: key,
      revenue: toNumber(row?.netSales),
      tickets: toNumber(row?.tickets),
      previous: toNumber(before.get(twin)?.netSales),
    }
  })
}

/** The branch's day start as the daily report takes it (HH:mm). */
export function dayStartParam(value: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '00:00'
}
