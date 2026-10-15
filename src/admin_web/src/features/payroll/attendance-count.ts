import { ATTENDANCE } from './format'

export type AttendanceCount = {
  /** Days worked: present counts 1, a half day ½ */
  worked: number
  /** Days marked absent: a half day's other half, never a day off */
  absent: number
  /** Days marked off: rest days, not absences */
  offDays: number
}

/**
 * A row of attendance marks summed the way pay reads them: worked days
 * (present 1, half day ½), absences, and days off apart, so a day off is
 * never counted as an absence.
 */
export function countAttendance(statuses: number[]): AttendanceCount {
  let worked = 0
  let absent = 0
  let offDays = 0
  for (const status of statuses) {
    if (status === ATTENDANCE.present) worked += 1
    else if (status === ATTENDANCE.halfDay) {
      worked += 0.5
      absent += 0.5
    } else if (status === ATTENDANCE.dayOff) offDays += 1
    else absent += 1
  }
  return { worked, absent, offDays }
}
