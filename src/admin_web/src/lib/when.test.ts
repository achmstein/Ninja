import { describe, expect, it } from 'vitest'
import { dayHeading, dayKey, formatWhen } from './when'

const t = (key: string, params?: Record<string, unknown>) =>
  key === 'minutesAgo'
    ? `${params?.minutes}m ago`
    : key === 'hoursAgo'
      ? `${params?.hours}h ago`
      : key
const now = new Date(2026, 9, 3, 15, 0) // Sat 3 Oct 2026, 15:00

describe('formatWhen', () => {
  it('never says seconds, and the year only when it is not this year', () => {
    const at = new Date(2026, 9, 1, 9, 5, 42)
    expect(formatWhen(at, 'dateTime', 'en-US', t, now)).toBe('Oct 1, 09:05 AM')
    expect(
      formatWhen(new Date(2025, 11, 31, 9, 5), 'date', 'en-US', t, now)
    ).toBe('Dec 31, 2025')
    expect(formatWhen(at, 'time', 'en-US', t, now)).not.toContain('42')
  })

  it('is relative while it is recent, then names the day', () => {
    expect(
      formatWhen(new Date(2026, 9, 3, 14, 59, 40), 'relative', 'en-US', t, now)
    ).toBe('justNow')
    expect(
      formatWhen(new Date(2026, 9, 3, 14, 35), 'relative', 'en-US', t, now)
    ).toBe('25m ago')
    expect(
      formatWhen(new Date(2026, 9, 3, 11, 0), 'relative', 'en-US', t, now)
    ).toBe('4h ago')
    expect(
      formatWhen(new Date(2026, 9, 2, 20, 10), 'relative', 'en-US', t, now)
    ).toMatch(/^yesterday 0?8:10/)
    expect(
      formatWhen(new Date(2026, 8, 28, 10, 0), 'relative', 'en-US', t, now)
    ).toBe('Mon, Sep 28')
  })

  it('says nothing is a dash', () => {
    expect(formatWhen(null, 'day', 'en-US', t, now)).toBe('—')
    expect(formatWhen('not a date', 'day', 'en-US', t, now)).toBe('—')
  })
})

describe('day groups', () => {
  it('keys a moment by its local day and heads today and yesterday by name', () => {
    expect(dayKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03')
    expect(dayHeading('2026-10-03', 'en-US', t, now)).toBe('today')
    expect(dayHeading('2026-10-02', 'en-US', t, now)).toBe('yesterday')
    expect(dayHeading('2026-09-28', 'en-US', t, now)).toBe('Mon, Sep 28')
  })
})
