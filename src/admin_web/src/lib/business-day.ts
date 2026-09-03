import { format } from 'date-fns'

export type DayWindow = { from: Date; to: Date }

// "HH:mm" or "HH:mm:ss" → minutes since local midnight
function timeToMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function atMinutes(day: Date, dayOffset: number, minutes: number): Date {
  const result = new Date(day)
  result.setDate(result.getDate() + dayOffset)
  result.setHours(0, minutes, 0, 0)
  return result
}

// The branch business day: DayStart → DayEnd, spilling into the next
// calendar day when the window crosses midnight (17:00 → 05:00). Before
// today's DayStart (say 02:00) we are still inside the window that opened
// YESTERDAY at DayStart. Missing times degrade to the calendar day.
export function businessDayWindow(
  dayStart: string | null | undefined,
  dayEnd: string | null | undefined,
  now: Date
): DayWindow {
  const startMinutes = timeToMinutes(dayStart) ?? 0
  const endMinutes = timeToMinutes(dayEnd) ?? startMinutes
  const crossesMidnight = endMinutes <= startMinutes

  let from = atMinutes(now, 0, startMinutes)
  if (crossesMidnight && now < from) {
    from = atMinutes(now, -1, startMinutes)
  }
  const to = atMinutes(from, crossesMidnight ? 1 : 0, endMinutes)
  return { from, to }
}

// The business day that OPENS on a given calendar day
function windowOpeningOn(
  day: Date,
  dayStart: string | null | undefined,
  dayEnd: string | null | undefined
): DayWindow {
  const startMinutes = timeToMinutes(dayStart) ?? 0
  const endMinutes = timeToMinutes(dayEnd) ?? startMinutes
  const crossesMidnight = endMinutes <= startMinutes
  const from = atMinutes(day, 0, startMinutes)
  const to = atMinutes(from, crossesMidnight ? 1 : 0, endMinutes)
  return { from, to }
}

export const rangePresets = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'custom',
] as const
export type RangePreset = (typeof rangePresets)[number]

// Presets span whole business days: from the first day's DayStart to the
// last day's DayEnd, so a report over "last 7 days" never cuts a night in
// half. Custom takes calendar days and does the same with them.
export function presetWindow(
  preset: RangePreset,
  dayStart: string | null | undefined,
  dayEnd: string | null | undefined,
  custom: { from?: Date; to?: Date } = {},
  now: Date = new Date()
): DayWindow {
  const today = businessDayWindow(dayStart, dayEnd, now)
  const dayOf = (day: Date) => windowOpeningOn(day, dayStart, dayEnd)

  if (preset === 'yesterday') return dayOf(atMinutes(today.from, -1, 0))
  if (preset === '7d') {
    return { from: dayOf(atMinutes(today.from, -6, 0)).from, to: today.to }
  }
  if (preset === '30d') {
    return { from: dayOf(atMinutes(today.from, -29, 0)).from, to: today.to }
  }
  if (preset === 'custom') {
    const first = custom.from ?? custom.to
    if (!first) return today
    const last = custom.to ?? first
    const [start, end] = first <= last ? [first, last] : [last, first]
    return { from: dayOf(start).from, to: dayOf(end).to }
  }
  return today
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
