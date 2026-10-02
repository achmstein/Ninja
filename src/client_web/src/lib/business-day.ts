import type { BranchResponse } from '@/api/tenant'
import { dayStartHour } from './branch'

/**
 * Start of the branch's current business day. A business day runs from its
 * start hour to the same hour the next day, whatever the hours it is open:
 * before the start hour it is still yesterday's. This held only for an
 * overnight branch before, so a day-time one (09:00 → 23:00) put the start
 * of "today" in the future between midnight and nine, and a table scanned
 * then counted as one from a day already over: the scan said "you are at
 * table 5" and the tray had no table.
 */
export function businessDayStart(branch?: BranchResponse | null, now: Date = new Date()): Date {
  return businessDayOf(now, branch, true)
}

/**
 * The business day a moment belongs to, as the calendar date it began on
 * (midnight of that date): what a list of bills or visits groups by.
 */
export function businessDayDate(date: Date, branch?: BranchResponse | null): Date {
  return businessDayOf(date, branch, false)
}

function businessDayOf(date: Date, branch: BranchResponse | null | undefined, atStartHour: boolean): Date {
  const startHour = dayStartHour(branch)
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (date.getHours() < startHour) day.setDate(day.getDate() - 1)
  if (atStartHour) day.setHours(startHour, 0, 0, 0)
  return day
}
