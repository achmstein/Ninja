import type { BranchResponse } from '@/api/branch'
import { dayStartHour, isOvernightShift } from './branch'

/**
 * Start of the branch's current business day (mobile parity): overnight
 * shifts (e.g. 17:00 → 05:00) that haven't reached the start hour yet still
 * belong to yesterday's shift.
 */
export function businessDayStart(branch?: BranchResponse | null): Date {
  const startHour = dayStartHour(branch)
  const overnight = isOvernightShift(branch)
  const now = new Date()
  const start = new Date(now)
  if (overnight && now.getHours() < startHour) {
    start.setDate(start.getDate() - 1)
  }
  start.setHours(startHour, 0, 0, 0)
  return start
}
