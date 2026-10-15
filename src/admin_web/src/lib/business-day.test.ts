import { describe, expect, it } from 'vitest'
import {
  businessDateOf,
  businessDayWindow,
  businessMonthWindow,
  formatDay,
  parseDay,
  presetWindow,
  previousWindow,
} from './business-day'
import { zonedTime } from './zoned-time'

// A business's day is not the calendar's: one that starts at five in the
// afternoon is still on Friday's takings at 01:00 on Saturday. Every report
// window on the back office's pages comes from here, in the business's own
// zone whatever zone the browser is in, so a mistake moves a night's money
// to the wrong day.

const CAIRO = 'Africa/Cairo'
const LATE = { dayStart: '17:00', timeZone: CAIRO } // a day that starts at five
const MORNING = { dayStart: '06:00', timeZone: CAIRO }

// An instant written in Cairo's wall time with its offset (+02:00 in winter, +03:00 in summer)
const at = (iso: string) => new Date(iso)
const local = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 0, 0, 0, 0)

describe('today, for a business whose day starts in the afternoon', () => {
  it('is the day that started yesterday while the night is still going', () => {
    const atOne = at('2026-03-15T01:00:00+02:00')
    const today = presetWindow('today', LATE, {}, atOne)
    expect(today.from.toISOString()).toBe(
      at('2026-03-14T17:00:00+02:00').toISOString()
    )
    expect(today.to.toISOString()).toBe(
      at('2026-03-15T17:00:00+02:00').toISOString()
    )
  })

  it('is today’s once it has started', () => {
    const today = presetWindow(
      'today',
      LATE,
      {},
      at('2026-03-15T20:00:00+02:00')
    )
    expect(today.from.toISOString()).toBe(
      at('2026-03-15T17:00:00+02:00').toISOString()
    )
    expect(today.to.toISOString()).toBe(
      at('2026-03-16T17:00:00+02:00').toISOString()
    )
  })

  it('is the whole calendar day when the branch never said when its day starts', () => {
    const today = presetWindow(
      'today',
      { timeZone: CAIRO },
      {},
      at('2026-03-15T20:00:00+02:00')
    )
    expect(today.from.toISOString()).toBe(
      at('2026-03-15T00:00:00+02:00').toISOString()
    )
    expect(today.to.toISOString()).toBe(
      at('2026-03-16T00:00:00+02:00').toISOString()
    )
  })

  it('follows the business’s zone, not the browser’s', () => {
    // 23:30 UTC on the 14th is already 01:30 on the 15th in Cairo, before a 06:00 start
    const lateUtc = new Date(Date.UTC(2026, 2, 14, 23, 30))
    expect(businessDateOf(lateUtc, MORNING)).toEqual({
      year: 2026,
      month: 3,
      day: 14,
    })
    expect(
      businessDateOf(lateUtc, { dayStart: '06:00', timeZone: 'UTC' })
    ).toEqual({ year: 2026, month: 3, day: 14 })
    expect(
      businessDateOf(new Date(Date.UTC(2026, 2, 15, 4, 30)), MORNING)
    ).toEqual({ year: 2026, month: 3, day: 15 })
  })
})

describe('the presets a report offers', () => {
  const now = at('2026-03-15T20:00:00+02:00')

  it('yesterday is the business day before, whole', () => {
    const yesterday = presetWindow('yesterday', LATE, {}, now)
    expect(yesterday.from.toISOString()).toBe(
      at('2026-03-14T17:00:00+02:00').toISOString()
    )
    expect(yesterday.to.toISOString()).toBe(
      at('2026-03-15T17:00:00+02:00').toISOString()
    )
  })

  it('seven days is exactly seven business days, ending with today’s', () => {
    const week = presetWindow('7d', LATE, {}, now)
    expect(week.from.toISOString()).toBe(
      at('2026-03-09T17:00:00+02:00').toISOString()
    )
    expect(week.to.toISOString()).toBe(
      at('2026-03-16T17:00:00+02:00').toISOString()
    )
    expect(week.to.getTime() - week.from.getTime()).toBe(7 * 24 * 3_600_000)
  })

  it('thirty days does the same, a month back', () => {
    const month = presetWindow('30d', LATE, {}, now)
    expect(month.from.toISOString()).toBe(
      at('2026-02-14T17:00:00+02:00').toISOString()
    )
    expect(month.to.toISOString()).toBe(
      at('2026-03-16T17:00:00+02:00').toISOString()
    )
  })
})

describe('a range the owner picked', () => {
  const now = at('2026-03-15T20:00:00+02:00')

  it('runs from the first day’s start to the last day’s end', () => {
    const custom = presetWindow(
      'custom',
      LATE,
      { from: local(2026, 3, 1), to: local(2026, 3, 3) },
      now
    )
    expect(custom.from.toISOString()).toBe(
      at('2026-03-01T17:00:00+02:00').toISOString()
    )
    expect(custom.to.toISOString()).toBe(
      at('2026-03-04T17:00:00+02:00').toISOString()
    )
  })

  it('reads a range picked backwards the right way round', () => {
    const backwards = presetWindow(
      'custom',
      LATE,
      { from: local(2026, 3, 3), to: local(2026, 3, 1) },
      now
    )
    expect(backwards.from.toISOString()).toBe(
      at('2026-03-01T17:00:00+02:00').toISOString()
    )
    expect(backwards.to.toISOString()).toBe(
      at('2026-03-04T17:00:00+02:00').toISOString()
    )
  })

  it('is one day when only one end was picked', () => {
    const one = presetWindow('custom', LATE, { from: local(2026, 3, 2) }, now)
    expect(one.from.toISOString()).toBe(
      at('2026-03-02T17:00:00+02:00').toISOString()
    )
    expect(one.to.toISOString()).toBe(
      at('2026-03-03T17:00:00+02:00').toISOString()
    )
  })

  it('is today when nothing was picked at all', () => {
    const none = presetWindow('custom', LATE, {}, now)
    expect(none.from.toISOString()).toBe(
      at('2026-03-15T17:00:00+02:00').toISOString()
    )
  })
})

describe('hours the owner picks in place of the branch’s', () => {
  it('narrow today to the afternoon', () => {
    const today = presetWindow(
      'today',
      { dayStart: '12:00', dayEnd: '18:00', timeZone: CAIRO },
      {},
      at('2026-03-15T14:00:00+02:00')
    )
    expect(today.from.toISOString()).toBe(
      at('2026-03-15T12:00:00+02:00').toISOString()
    )
    expect(today.to.toISOString()).toBe(
      at('2026-03-15T18:00:00+02:00').toISOString()
    )
  })

  it('cross midnight on a custom range when the end is earlier than the start', () => {
    const custom = presetWindow(
      'custom',
      { dayStart: '20:00', dayEnd: '03:00', timeZone: CAIRO },
      { from: local(2026, 3, 1), to: local(2026, 3, 2) },
      at('2026-03-15T14:00:00+02:00')
    )
    expect(custom.from.toISOString()).toBe(
      at('2026-03-01T20:00:00+02:00').toISOString()
    )
    expect(custom.to.toISOString()).toBe(
      at('2026-03-03T03:00:00+02:00').toISOString()
    )
  })
})

describe('across Cairo’s clock change at the end of summer time (29 October 2026)', () => {
  // At midnight between Thursday 29 and Friday 30 October the clocks go
  // back from 00:00 (+03:00) to 23:00 (+02:00) on the Thursday
  it('makes that business day 25 hours long', () => {
    const day = businessDayWindow({ year: 2026, month: 10, day: 29 }, MORNING)
    expect(day.from.toISOString()).toBe(
      at('2026-10-29T06:00:00+03:00').toISOString()
    )
    expect(day.to.toISOString()).toBe(
      at('2026-10-30T06:00:00+02:00').toISOString()
    )
    expect(day.to.getTime() - day.from.getTime()).toBe(25 * 3_600_000)
  })

  it('keeps the day after it 24 hours, starting at 06:00 winter time', () => {
    const day = businessDayWindow({ year: 2026, month: 10, day: 30 }, MORNING)
    expect(day.from.toISOString()).toBe('2026-10-30T04:00:00.000Z')
    expect(day.to.toISOString()).toBe('2026-10-31T04:00:00.000Z')
  })

  it('puts a sale in the repeated hour on the right business day', () => {
    // 23:30 summer time, then 23:30 again in winter time: both still Thursday's
    expect(businessDateOf(new Date('2026-10-29T20:30:00Z'), MORNING)).toEqual({
      year: 2026,
      month: 10,
      day: 29,
    })
    expect(businessDateOf(new Date('2026-10-29T21:30:00Z'), MORNING)).toEqual({
      year: 2026,
      month: 10,
      day: 29,
    })
    expect(businessDateOf(new Date('2026-10-30T03:59:00Z'), MORNING)).toEqual({
      year: 2026,
      month: 10,
      day: 29,
    })
    expect(businessDateOf(new Date('2026-10-30T04:00:00Z'), MORNING)).toEqual({
      year: 2026,
      month: 10,
      day: 30,
    })
  })

  it('makes "last 7 days" seven business days and 169 hours across the change', () => {
    const week = presetWindow(
      '7d',
      MORNING,
      {},
      at('2026-11-01T12:00:00+02:00')
    )
    expect(week.from.toISOString()).toBe(
      at('2026-10-26T06:00:00+03:00').toISOString()
    )
    expect(week.to.toISOString()).toBe(
      at('2026-11-02T06:00:00+02:00').toISOString()
    )
    expect(week.to.getTime() - week.from.getTime()).toBe(169 * 3_600_000)
  })

  it('reads the repeated wall time as its first occurrence', () => {
    expect(
      zonedTime(
        { year: 2026, month: 10, day: 29 },
        23 * 60 + 30,
        CAIRO
      ).toISOString()
    ).toBe('2026-10-29T20:30:00.000Z')
  })
})

describe('the period to compare with', () => {
  it('is the same stretch of the week before while today is still going', () => {
    // Two hours into the Friday after the change: the Friday before (in summer time) up to two hours in
    const now = at('2026-10-30T08:00:00+02:00')
    const today = presetWindow('today', MORNING, {}, now)
    const before = previousWindow(today, MORNING, now)
    expect(before.from.toISOString()).toBe(
      at('2026-10-29T06:00:00+03:00').toISOString()
    )
    expect(before.to.getTime() - before.from.getTime()).toBe(2 * 3_600_000)
  })

  it('is the whole span before a finished window, in business days', () => {
    const now = at('2026-11-05T12:00:00+02:00')
    const week = presetWindow(
      'custom',
      MORNING,
      { from: local(2026, 10, 26), to: local(2026, 11, 1) },
      now
    )
    const before = previousWindow(week, MORNING, now)
    expect(before.from.toISOString()).toBe(
      at('2026-10-19T06:00:00+03:00').toISOString()
    )
    expect(before.to.toISOString()).toBe(
      at('2026-10-26T06:00:00+03:00').toISOString()
    )
  })
})

describe('the business month', () => {
  it('starts at the first business day’s start, not the browser’s midnight', () => {
    // 03:00 on 1 November is still 31 October's business day
    const month = businessMonthWindow(at('2026-11-01T03:00:00+02:00'), MORNING)
    expect(month.from.toISOString()).toBe(
      at('2026-10-01T06:00:00+03:00').toISOString()
    )
    expect(month.to.toISOString()).toBe(
      at('2026-11-01T06:00:00+02:00').toISOString()
    )
  })
})

describe('a day in a URL', () => {
  it('goes out as yyyy-MM-dd and comes back the same day', () => {
    expect(formatDay(new Date(2026, 2, 15, 23, 30))).toBe('2026-03-15')
    expect(parseDay('2026-03-15')?.toISOString()).toBe(
      local(2026, 3, 15).toISOString()
    )
  })

  it('reads nothing out of what is not a day', () => {
    expect(parseDay(undefined)).toBeUndefined()
    expect(parseDay('yesterday')).toBeUndefined()
    expect(parseDay('2026-3-5')).toBeUndefined()
  })
})
