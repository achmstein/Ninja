import { describe, expect, it } from 'vitest'
import { formatDay, parseDay, presetWindow } from './business-day'

// A café's day is not the calendar's: one that closes at two in the
// morning is still on Friday's takings at 01:00 on Saturday. Every report
// window on the back office's pages comes from here, so a mistake moves a
// night's money to the wrong day.

const LATE = { start: '17:00', end: '02:00' } // opens at five, closes at two
const DAY = { start: '08:00', end: '23:00' } // opens at eight, closes at eleven

const local = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0)

describe('today, for a café that closes after midnight', () => {
  it('is the window that opened yesterday when the night is still going', () => {
    const atOne = local(2026, 3, 15, 1) // Sunday, 01:00: still Saturday's night
    const today = presetWindow('today', LATE.start, LATE.end, {}, atOne)
    expect(today.from.toISOString()).toBe(local(2026, 3, 14, 17).toISOString())
    expect(today.to.toISOString()).toBe(local(2026, 3, 15, 2).toISOString())
  })

  it('is today’s window once it has opened', () => {
    const atEight = local(2026, 3, 15, 20)
    const today = presetWindow('today', LATE.start, LATE.end, {}, atEight)
    expect(today.from.toISOString()).toBe(local(2026, 3, 15, 17).toISOString())
    expect(today.to.toISOString()).toBe(local(2026, 3, 16, 2).toISOString())
  })

  it('is the calendar day for a café that closes before midnight', () => {
    const today = presetWindow('today', DAY.start, DAY.end, {}, local(2026, 3, 15, 20))
    expect(today.from.toISOString()).toBe(local(2026, 3, 15, 8).toISOString())
    expect(today.to.toISOString()).toBe(local(2026, 3, 15, 23).toISOString())
  })

  it('is the whole calendar day when the café never said its hours', () => {
    const today = presetWindow('today', null, null, {}, local(2026, 3, 15, 20))
    expect(today.from.toISOString()).toBe(local(2026, 3, 15).toISOString())
    expect(today.to.toISOString()).toBe(local(2026, 3, 16).toISOString())
  })
})

describe('the presets a report offers', () => {
  const now = local(2026, 3, 15, 20)

  it('yesterday is the night before, whole', () => {
    const yesterday = presetWindow('yesterday', LATE.start, LATE.end, {}, now)
    expect(yesterday.from.toISOString()).toBe(local(2026, 3, 14, 17).toISOString())
    expect(yesterday.to.toISOString()).toBe(local(2026, 3, 15, 2).toISOString())
  })

  it('seven days ends with tonight and starts six nights back', () => {
    const week = presetWindow('7d', LATE.start, LATE.end, {}, now)
    expect(week.from.toISOString()).toBe(local(2026, 3, 9, 17).toISOString())
    expect(week.to.toISOString()).toBe(local(2026, 3, 16, 2).toISOString())
  })

  it('thirty days does the same, a month back', () => {
    const month = presetWindow('30d', LATE.start, LATE.end, {}, now)
    expect(month.from.toISOString()).toBe(local(2026, 2, 14, 17).toISOString())
    expect(month.to.toISOString()).toBe(local(2026, 3, 16, 2).toISOString())
  })
})

describe('a range the owner picked', () => {
  const now = local(2026, 3, 15, 20)

  it('runs from the first night’s opening to the last night’s close', () => {
    const custom = presetWindow('custom', LATE.start, LATE.end, { from: local(2026, 3, 1), to: local(2026, 3, 3) }, now)
    expect(custom.from.toISOString()).toBe(local(2026, 3, 1, 17).toISOString())
    expect(custom.to.toISOString()).toBe(local(2026, 3, 4, 2).toISOString())
  })

  it('reads a range picked backwards the right way round', () => {
    const backwards = presetWindow('custom', LATE.start, LATE.end, { from: local(2026, 3, 3), to: local(2026, 3, 1) }, now)
    expect(backwards.from.toISOString()).toBe(local(2026, 3, 1, 17).toISOString())
    expect(backwards.to.toISOString()).toBe(local(2026, 3, 4, 2).toISOString())
  })

  it('is one night when only one end was picked', () => {
    const one = presetWindow('custom', LATE.start, LATE.end, { from: local(2026, 3, 2) }, now)
    expect(one.from.toISOString()).toBe(local(2026, 3, 2, 17).toISOString())
    expect(one.to.toISOString()).toBe(local(2026, 3, 3, 2).toISOString())
  })

  it('is tonight when nothing was picked at all', () => {
    const none = presetWindow('custom', LATE.start, LATE.end, {}, now)
    expect(none.from.toISOString()).toBe(local(2026, 3, 15, 17).toISOString())
  })
})

describe('a day in a URL', () => {
  it('goes out as yyyy-MM-dd in the café’s own time and comes back the same day', () => {
    expect(formatDay(local(2026, 3, 15, 23, 30))).toBe('2026-03-15')
    expect(parseDay('2026-03-15')?.toISOString()).toBe(local(2026, 3, 15).toISOString())
  })

  it('reads nothing out of what is not a day', () => {
    expect(parseDay(undefined)).toBeUndefined()
    expect(parseDay('yesterday')).toBeUndefined()
    expect(parseDay('2026-3-5')).toBeUndefined()
  })
})
