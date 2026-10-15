import { format } from 'date-fns'
import {
  addDays,
  daysBetween,
  plainDateOfLocal,
  safeTimeZone,
  zonedParts,
  zonedTime,
  type PlainDate,
} from './zoned-time'

export type DayWindow = { from: Date; to: Date }

/**
 * When a business day starts and in which zone. A branch's day runs from its
 * DayStart to the same time the next day, in the business's own zone (the
 * tenant's), whatever zone the browser is in. `dayEnd` is only ever an end
 * the owner picked on a report ("12:00 → 18:00"); the branch has none.
 */
export type BusinessHours = {
  dayStart?: string | null
  dayEnd?: string | null
  timeZone?: string | null
}

// "HH:mm" or "HH:mm:ss" → minutes since midnight
function timeToMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function resolve(hours: BusinessHours) {
  const start = timeToMinutes(hours.dayStart) ?? 0
  const end = timeToMinutes(hours.dayEnd)
  return {
    start,
    end,
    // A picked end at or before the start runs into the next day; with no
    // end the day always does, to the next day's start
    crossesMidnight: end == null || end <= start,
    timeZone: safeTimeZone(hours.timeZone),
  }
}

/**
 * The business day `now` falls in, by its date: before the day's start
 * (02:00 on a day that starts at 06:00) it is still the day before.
 */
export function businessDateOf(now: Date, hours: BusinessHours): PlainDate {
  const { start, crossesMidnight, timeZone } = resolve(hours)
  const wall = zonedParts(now, timeZone)
  const today = { year: wall.year, month: wall.month, day: wall.day }
  const minutes = wall.hour * 60 + wall.minute
  return crossesMidnight && minutes < start ? addDays(today, -1) : today
}

/** The window of the business day named `date`, as UTC instants. */
export function businessDayWindow(
  date: PlainDate,
  hours: BusinessHours
): DayWindow {
  const { start, end, crossesMidnight, timeZone } = resolve(hours)
  const from = zonedTime(date, start, timeZone)
  const to =
    end == null
      ? zonedTime(addDays(date, 1), start, timeZone)
      : zonedTime(crossesMidnight ? addDays(date, 1) : date, end, timeZone)
  return { from, to }
}

/** From the first day's start to the last day's end. */
export function businessDaysWindow(
  first: PlainDate,
  last: PlainDate,
  hours: BusinessHours
): DayWindow {
  return {
    from: businessDayWindow(first, hours).from,
    to: businessDayWindow(last, hours).to,
  }
}

/**
 * The business month so far: from the first business day of the month
 * today's business day is in, to the end of today's.
 */
export function businessMonthWindow(
  now: Date,
  hours: BusinessHours
): DayWindow {
  const today = businessDateOf(now, hours)
  return businessDaysWindow({ ...today, day: 1 }, today, hours)
}

/**
 * How far into a window `now` is, so a period still going is compared with
 * the same stretch of the one before it, not with all of it.
 */
export function elapsedOf(window: DayWindow, now: Date): number {
  const end = Math.min(now.getTime(), window.to.getTime())
  return Math.max(0, end - window.from.getTime())
}

/**
 * The window to compare `window` with: the one just before it, as many
 * business days long, cut to the same elapsed time when `window` is still
 * going. Days, not milliseconds, so a clock change between them does not
 * shift the comparison by an hour.
 */
export function previousWindow(
  window: DayWindow,
  hours: BusinessHours,
  now: Date
): DayWindow {
  const first = businessDateOf(window.from, hours)
  const last = businessDateOf(new Date(window.to.getTime() - 1), hours)
  const days = daysBetween(first, last) + 1
  const before = businessDaysWindow(
    addDays(first, -days),
    addDays(last, -days),
    hours
  )
  if (now.getTime() >= window.to.getTime()) return before
  return {
    from: before.from,
    to: new Date(before.from.getTime() + elapsedOf(window, now)),
  }
}

export const rangePresets = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'custom',
] as const
export type RangePreset = (typeof rangePresets)[number]

// Presets span whole business days, from the first day's start to the last
// day's end, so a report over "last 7 days" is exactly seven business days
// and never cuts a night in half. Custom takes calendar days and does the
// same with them.
export function presetWindow(
  preset: RangePreset,
  hours: BusinessHours,
  custom: { from?: Date; to?: Date } = {},
  now: Date = new Date()
): DayWindow {
  const today = businessDateOf(now, hours)

  if (preset === 'yesterday')
    return businessDayWindow(addDays(today, -1), hours)
  if (preset === '7d')
    return businessDaysWindow(addDays(today, -6), today, hours)
  if (preset === '30d')
    return businessDaysWindow(addDays(today, -29), today, hours)
  if (preset === 'custom') {
    const first = custom.from ?? custom.to
    if (!first) return businessDayWindow(today, hours)
    const last = custom.to ?? first
    const [start, end] = first <= last ? [first, last] : [last, first]
    return businessDaysWindow(
      plainDateOfLocal(start),
      plainDateOfLocal(end),
      hours
    )
  }
  return businessDayWindow(today, hours)
}

// URL form of a calendar day (yyyy-MM-dd), in local time
export function formatDay(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDay(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * For endpoints that only know a fixed offset (JS getTimezoneOffset: UTC
 * minus local, in minutes) and start "today" at that offset's midnight:
 * the offset that makes their midnight the business day's start, so their
 * "today" is today's business day in the business's zone.
 */
export function businessDayOffsetMinutes(
  now: Date,
  hours: BusinessHours
): number {
  const start = businessDayWindow(businessDateOf(now, hours), hours).from
  return start.getUTCHours() * 60 + start.getUTCMinutes()
}
