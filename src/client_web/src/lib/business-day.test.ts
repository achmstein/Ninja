import { describe, expect, it } from 'vitest'
import type { BranchResponse } from '@/api/tenant'
import { businessDayDate, businessDayStart } from './business-day'

const opensAt = (hour: string) => ({ dayStartTime: `${hour}:00` }) as BranchResponse

describe('the business day', () => {
  it('a day-time branch: past midnight, before it opens, is still yesterday', () => {
    const at = new Date(2026, 9, 3, 1, 30)
    expect(businessDayStart(opensAt('09'), at)).toEqual(new Date(2026, 9, 2, 9, 0))
    // so a table scanned now is in today, not before it
    expect(at.getTime()).toBeGreaterThanOrEqual(businessDayStart(opensAt('09'), at).getTime())
  })

  it('an evening branch: past midnight is still the evening that began yesterday', () => {
    expect(businessDayStart(opensAt('17'), new Date(2026, 9, 3, 2, 0))).toEqual(new Date(2026, 9, 2, 17, 0))
    expect(businessDayStart(opensAt('17'), new Date(2026, 9, 3, 18, 0))).toEqual(new Date(2026, 9, 3, 17, 0))
  })

  it('groups a moment under the date its day began', () => {
    expect(businessDayDate(new Date(2026, 9, 3, 4, 0), opensAt('06'))).toEqual(new Date(2026, 9, 2))
    expect(businessDayDate(new Date(2026, 9, 3, 7, 0), opensAt('06'))).toEqual(new Date(2026, 9, 3))
  })
})
