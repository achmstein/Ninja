import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatClock, noteServerDate, serverNow } from './clock'

const PHONE = Date.parse('2026-09-27T09:00:00Z')

describe('serverNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(PHONE)
  })
  afterEach(() => {
    noteServerDate(new Date(PHONE).toUTCString())
    vi.useRealTimers()
  })

  it('counts by the server when the phone is set hours behind', () => {
    noteServerDate('Sun, 27 Sep 2026 12:00:00 GMT')
    expect(Math.round((serverNow() - PHONE) / 3_600_000)).toBe(3)
  })

  it('trusts the phone when the gap is only the header rounding and the trip', () => {
    noteServerDate('Sun, 27 Sep 2026 09:00:02 GMT')
    expect(serverNow()).toBe(PHONE)
  })

  it('ignores an answer with no date', () => {
    noteServerDate('Sun, 27 Sep 2026 12:00:00 GMT')
    noteServerDate(undefined)
    expect(serverNow()).toBeGreaterThan(PHONE)
  })
})

describe('formatClock', () => {
  it('reads m:ss under an hour and h:mm:ss past it', () => {
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-4)).toBe('0:00')
  })
})
