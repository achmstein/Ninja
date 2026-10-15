import { describe, expect, it } from 'vitest'
import { countAttendance } from './attendance-count'
import { ATTENDANCE } from './format'

describe('a row of attendance marks', () => {
  it('never counts a day off as an absence', () => {
    const { present, halfDay, absent, dayOff } = ATTENDANCE
    expect(
      countAttendance([present, present, halfDay, dayOff, dayOff, absent])
    ).toEqual({
      worked: 2.5,
      absent: 1.5,
      offDays: 2,
    })
  })

  it('is nothing for an unmarked row', () => {
    expect(countAttendance([])).toEqual({ worked: 0, absent: 0, offDays: 0 })
  })
})
