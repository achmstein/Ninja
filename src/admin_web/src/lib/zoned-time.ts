/**
 * Wall-clock time in the business's own IANA zone (the tenant's
 * locale.timeZone, Africa/Cairo by default), whatever zone the browser is in.
 * Intl does the zone rules, DST included, so no library is needed: a day
 * across a clock change is 23 or 25 hours long, as it is at the till.
 */

/** The platform's zone when a business never set one (TenantClock's default). */
export const DEFAULT_TIME_ZONE = 'Africa/Cairo'

/** A calendar date with no time and no zone: a business day's name. */
export type PlainDate = { year: number; month: number; day: number }

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = formatters.get(timeZone)
  if (!found) {
    found = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, found)
  }
  return found
}

/** The zone itself when Intl knows it, else the platform's default. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE
  try {
    formatter(timeZone)
    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export type ZonedParts = PlainDate & {
  hour: number
  minute: number
  second: number
}

/** What a clock on the wall in `timeZone` read at `instant`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, number> = {}
  for (const part of formatter(safeTimeZone(timeZone)).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    // Some engines spell midnight 24 even in h23
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** The zone's offset from UTC at an instant, in milliseconds. */
function offsetAt(instantMs: number, timeZone: string): number {
  const p = zonedParts(new Date(instantMs), timeZone)
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return wall - Math.floor(instantMs / 1000) * 1000
}

/**
 * The instant a wall clock in `timeZone` reads `minutes` past midnight of
 * `date`. A time the clock skips (spring forward) lands just after the gap;
 * one it reads twice (fall back) is the first of the two.
 */
export function zonedTime(
  date: PlainDate,
  minutes: number,
  timeZone: string
): Date {
  const zone = safeTimeZone(timeZone)
  const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minutes)
  // Two passes settle on the offset in force at the answer itself
  const first = wall - offsetAt(wall, zone)
  const second = wall - offsetAt(first, zone)
  if (second === first) {
    // A repeated hour: take the earlier reading when there is one
    const earlier = second - 60 * 60_000
    if (wall - offsetAt(earlier, zone) === earlier) return new Date(earlier)
    return new Date(second)
  }
  // In a gap the two guesses straddle it: the later one reads past the gap
  return new Date(Math.max(first, second))
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  }
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: PlainDate, b: PlainDate): number {
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      86_400_000
  )
}

export function comparePlainDates(a: PlainDate, b: PlainDate): number {
  return daysBetween(b, a)
}

/** yyyy-MM-dd, the form the Sales daily report names its days by. */
export function plainDateKey(date: PlainDate): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`
}

export function parsePlainDate(
  value: string | null | undefined
): PlainDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return undefined
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/** The calendar day a date picker handed over (a browser-local midnight). */
export function plainDateOfLocal(date: Date): PlainDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

/** A plain date as a browser-local midnight, for date pickers and date-fns formatting. */
export function localDateOf(date: PlainDate): Date {
  return new Date(date.year, date.month - 1, date.day)
}
