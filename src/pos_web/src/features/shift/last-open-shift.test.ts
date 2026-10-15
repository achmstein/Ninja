import { describe, expect, it } from 'vitest'
import { withOpenShift } from './last-open-shift'

describe('withOpenShift', () => {
  it('keeps one open shift per branch', () => {
    let shifts = withOpenShift({}, 3, 41)
    shifts = withOpenShift(shifts, 4, 9)
    shifts = withOpenShift(shifts, 3, 42)
    expect(shifts).toEqual({ '3': 42, '4': 9 })
  })

  it('forgets a branch whose shift closed', () => {
    expect(withOpenShift({ '3': 42, '4': 9 }, 3, null)).toEqual({ '4': 9 })
  })
})
