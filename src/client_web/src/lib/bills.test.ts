import { describe, expect, it } from 'vitest'
import { type BillLineView, type BillView } from '@/api/sales'
import { type StayViewModel } from '@/api/spaces'
import { billParts, closedAt, isOpen, isOthers, isSettled, isTimeLine, isUnassigned, percent, runningTime } from './bills'

// The customer's own bill, as their phone works it out between refreshes:
// the clock's time before the till stops it, and how much of the total is
// certainly theirs. Mirrors Sales' own arithmetic — the till's figure is
// the one that is charged, so these must agree with it.

const now = Date.parse('2026-03-15T20:00:00Z')

function at(minutesBeforeNow: number): string {
  return new Date(now - minutesBeforeNow * 60_000).toISOString()
}

function bill(over: Partial<BillView> = {}): BillView {
  return {
    id: 1,
    status: 'Open',
    sessionId: 5,
    sessionEndedAt: null,
    discountRate: 0,
    vatRate: 0.14,
    vatIncluded: false,
    total: 100,
    lines: [],
    ...over,
  }
}

function stay(over: Partial<StayViewModel> = {}): StayViewModel {
  return {
    id: 5,
    startedAt: at(90),
    tariff: { roundingMinutes: 15, options: [] },
    segments: [{ optionCode: 'single', optionName: { en: 'Single' }, hourlyRate: 40, startTime: at(90) }],
    ...over,
  }
}

const line = (over: Partial<BillLineView> = {}): BillLineView => ({ id: 1, source: 'Order', total: 50, isMine: true, ...over })

describe('the clock on an open bill', () => {
  it('is the minutes so far, rounded to the tariff’s step at the rate they ran on', () => {
    const running = runningTime(bill(), stay(), now)!
    expect(running.minutes).toBe(90)
    expect(running.parts).toEqual([{ optionName: { en: 'Single' }, hours: 1.5, rate: 40, cost: 60 }])
  })

  it('is charged the way the till will charge it: discount off, VAT on, no service', () => {
    // Room time is not an order, so the service charge never touches it
    expect(runningTime(bill(), stay(), now)!.charged).toBeCloseTo(60 * 1.14, 6)
    expect(runningTime(bill({ vatIncluded: true }), stay(), now)!.charged).toBe(60)
    expect(runningTime(bill({ discountRate: 0.5 }), stay(), now)!.charged).toBeCloseTo(30 * 1.14, 6)
  })

  it('counts each rate the party moved through', () => {
    const moved = stay({
      segments: [
        { optionCode: 'single', optionName: { en: 'Single' }, hourlyRate: 40, startTime: at(90), endTime: at(30) },
        { optionCode: 'multi', optionName: { en: 'Multi' }, hourlyRate: 60, startTime: at(30) },
      ],
    })
    expect(runningTime(bill(), moved, now)!.parts.map((p) => [p.hours, p.cost])).toEqual([
      [1, 40],
      [0.5, 30],
    ])
  })

  it('is nothing once the till has stopped it, or on a bill that is not open', () => {
    expect(runningTime(bill({ sessionEndedAt: at(5) }), stay(), now)).toBeNull()
    expect(runningTime(bill({ status: 'Settled' }), stay(), now)).toBeNull()
  })

  it('is nothing when the stay on the phone is not this bill’s', () => {
    expect(runningTime(bill(), stay({ id: 6 }), now)).toBeNull()
    expect(runningTime(bill(), undefined, now)).toBeNull()
    expect(runningTime(bill({ sessionId: null }), stay(), now)).toBeNull()
  })
})

describe('whose round is whose', () => {
  it('reads the till’s own words: mine, somebody else’s, or nobody’s yet', () => {
    expect(isTimeLine(line({ source: 'SessionTime' }))).toBe(true)
    expect(isOthers(line({ isMine: false, customerName: 'Hany' }))).toBe(true)
    expect(isUnassigned(line({ isMine: false, customerName: null }))).toBe(true)
    expect(isUnassigned(line({ isMine: false, source: 'SessionTime' }))).toBe(false)
    expect(isOthers(line({ isMine: false, customerName: null }))).toBe(false)
  })
})

describe('what of the bill is certainly the customer’s', () => {
  it('adds up their own rounds at menu prices, and the place’s time on its own', () => {
    const open = bill({
      lines: [line({ total: 50 }), line({ id: 2, total: 30, isMine: false, customerName: 'Hany' }), line({ id: 3, source: 'SessionTime', total: 120, isMine: false })],
      total: 200,
    })
    const parts = billParts(open, null, undefined)
    expect(parts.ownLines).toBe(50)
    expect(parts.time).toBe(120)
    expect(parts.total).toBe(200)
  })

  it('counts a clock still running into the time and the total', () => {
    const running = runningTime(bill(), stay(), now)
    const parts = billParts(bill(), running, stay())
    expect(parts.time).toBe(60)
    expect(parts.total).toBeCloseTo(100 + 60 * 1.14, 6)
  })

  it('is shared when somebody else is named on it, or the room has a roster', () => {
    const withOthers = bill({ lines: [line({ id: 2, isMine: false, customerName: 'Hany' })] })
    expect(billParts(withOthers, null, undefined).shared).toBe(true)

    const together = stay({ members: [{ customerId: 'a' }, { customerId: 'b' }] })
    expect(billParts(bill(), runningTime(bill(), together, now), together).shared).toBe(true)
  })

  it('is not shared by a round the till has not named yet', () => {
    const unnamed = bill({ lines: [line({ id: 2, isMine: false, customerName: null })] })
    expect(billParts(unnamed, null, undefined).shared).toBe(false)
  })
})

describe('the bill’s own state', () => {
  it('is open, settled, or neither', () => {
    expect(isOpen(bill())).toBe(true)
    expect(isSettled(bill({ status: 'Settled' }))).toBe(true)
    expect(isOpen(bill({ status: 'Voided' }))).toBe(false)
  })

  it('closed when the till settled or voided it, and not before', () => {
    expect(closedAt(bill())).toBeNull()
    expect(closedAt(bill({ status: 'Settled', settledAt: at(10) }))?.getTime()).toBe(now - 10 * 60_000)
  })

  it('says a rate as a whole number of percent', () => {
    expect(percent(0.14)).toBe(14)
    expect(percent(null)).toBe(0)
  })
})
