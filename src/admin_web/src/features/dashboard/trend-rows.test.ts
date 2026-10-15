import { describe, expect, it } from 'vitest'
import { dayStartParam, trendRows, trendWindows } from './trend-rows'

const MORNING = { dayStart: '06:00', timeZone: 'Africa/Cairo' }

describe('the sales chart’s windows', () => {
  it('ends with today’s business day and compares the same stretch of the week before', () => {
    // Monday 2 November, 08:00 Cairo (winter time), two hours into the day
    const now = new Date('2026-11-02T08:00:00+02:00')
    const w = trendWindows(now, MORNING, 7)
    expect(w.first).toEqual({ year: 2026, month: 10, day: 27 })
    expect(w.current.from.toISOString()).toBe(
      new Date('2026-10-27T06:00:00+03:00').toISOString()
    )
    expect(w.current.to.toISOString()).toBe(
      new Date('2026-11-03T06:00:00+02:00').toISOString()
    )
    // The seven days before, across the clock change, and only as far as
    // today has gone into its own seven: six whole days and two hours
    expect(w.previousFirst).toEqual({ year: 2026, month: 10, day: 20 })
    expect(w.previous.from.toISOString()).toBe(
      new Date('2026-10-20T06:00:00+03:00').toISOString()
    )
    expect(w.previous.to.getTime() - w.previous.from.getTime()).toBe(
      now.getTime() - w.current.from.getTime()
    )
  })

  it('rolls over at the day start, not at midnight', () => {
    const before = trendWindows(
      new Date('2026-11-02T05:59:00+02:00'),
      MORNING,
      7
    )
    const after = trendWindows(
      new Date('2026-11-02T06:00:00+02:00'),
      MORNING,
      7
    )
    expect(before.first).toEqual({ year: 2026, month: 10, day: 26 })
    expect(after.first).toEqual({ year: 2026, month: 10, day: 27 })
  })

  it('cuts the comparison to the five minutes, so the query key does not move every tick', () => {
    const a = trendWindows(new Date('2026-11-02T08:01:00+02:00'), MORNING, 7)
    const b = trendWindows(new Date('2026-11-02T08:04:00+02:00'), MORNING, 7)
    expect(a.previous.to.toISOString()).toBe(b.previous.to.toISOString())
  })
})

describe('the chart’s rows', () => {
  it('has every day with its twin, net of refunds, and zero for a day the report did not list', () => {
    const rows = trendRows(
      {
        first: { year: 2026, month: 10, day: 28 },
        previousFirst: { year: 2026, month: 10, day: 25 },
      },
      3,
      [
        {
          date: '2026-10-28',
          tickets: 4,
          grossSales: 500,
          refunds: 50,
          netSales: 450,
          refundCount: 1,
        },
        {
          date: '2026-10-30',
          tickets: 1,
          grossSales: 80,
          refunds: 0,
          netSales: 80,
          refundCount: 0,
        },
      ],
      [
        {
          date: '2026-10-26',
          tickets: 2,
          grossSales: 300,
          refunds: 0,
          netSales: 300,
          refundCount: 0,
        },
      ]
    )
    expect(rows).toEqual([
      { date: '2026-10-28', revenue: 450, tickets: 4, previous: 0 },
      { date: '2026-10-29', revenue: 0, tickets: 0, previous: 300 },
      { date: '2026-10-30', revenue: 80, tickets: 1, previous: 0 },
    ])
  })

  it('hands the daily report the day start as HH:mm', () => {
    expect(dayStartParam('06:00:00')).toBe('06:00')
    expect(dayStartParam('6:30')).toBe('06:30')
    expect(dayStartParam(null)).toBe('00:00')
  })
})
