import { describe, expect, it } from 'vitest'
import type {
  PlaceViewModel,
  ReservationViewModel,
  StayViewModel,
  TariffViewModel,
} from '@/api/spaces/types.gen'
import {
  elapsedSeconds,
  estimateStayCost,
  expiresInSeconds,
  findOption,
  formatClock,
  hasOptions,
  isHolding,
  isOpenReservation,
  isRoom,
  isRunning,
  isTimed,
  optionSeconds,
  roundedHours,
  stayBilledHours,
  stayRoster,
  tariffLine,
  PLACE_TABLE,
  RESERVATION_CANCELLED,
  RESERVATION_CONFIRMED,
  RESERVATION_REQUESTED,
  STAY_ENDED,
  STAY_RUNNING,
} from './status'

// What the floor screen works out for itself: whether a place runs a clock,
// how long it has run, and what the cashier is about to be asked for. The
// server bills the same way when the segment closes; this is the preview
// beside it, so the two must round alike.

const tariff: TariffViewModel = {
  roundingMinutes: 15,
  options: [
    { code: 'single', name: { en: 'Single' }, hourlyRate: 40 },
    { code: 'multi', name: { en: 'Multi' }, hourlyRate: 60 },
  ],
}

const now = Date.parse('2026-03-15T14:00:00Z')

function at(minutesBeforeNow: number): string {
  return new Date(now - minutesBeforeNow * 60_000).toISOString()
}

describe('a place with a clock', () => {
  const room: PlaceViewModel = { id: 1, kind: 1, isTimed: true, tariff }
  const table: PlaceViewModel = { id: 2, kind: PLACE_TABLE, isTimed: false }

  it('is timed when it has a tariff and the café bills time', () => {
    expect(isTimed(room)).toBe(true)
    expect(isTimed(room, true)).toBe(true)
    expect(isTimed(table)).toBe(false)
  })

  it('is a plain table when the clock is not in the plan, tariff or no tariff', () => {
    // A café that dropped to a smaller plan keeps the rates it set; the
    // floor must open the room as a table, or the till asks Spaces for a
    // stay it will refuse
    expect(isTimed(room, false)).toBe(false)
    expect(isTimed(table, false)).toBe(false)
  })

  it('says nothing about a place that is not there', () => {
    expect(isTimed(null)).toBe(false)
    expect(isTimed(undefined, true)).toBe(false)
    expect(isRoom(room)).toBe(true)
    expect(isRoom(table)).toBe(false)
    expect(isRoom(null)).toBe(true) // the floor's default shape
  })
})

describe('the tariff', () => {
  it('has a choice only when there is more than one rate', () => {
    expect(hasOptions(tariff)).toBe(true)
    expect(hasOptions({ roundingMinutes: 15, options: [tariff.options![0]] })).toBe(false)
    expect(hasOptions(null)).toBe(false)
  })

  it('finds the rate a stay is running on, and nothing for a code it does not have', () => {
    expect(findOption(tariff, 'multi')?.hourlyRate).toBe(60)
    expect(findOption(tariff, 'family')).toBeUndefined()
    expect(findOption(tariff, null)).toBeUndefined()
  })

  it('reads as one line: the rate alone, or every rate named', () => {
    const money = (value: number | string | undefined) => `${Number(value ?? 0)} EGP`
    const localized = (text: { en?: string } | null | undefined) => text?.en ?? ''
    expect(tariffLine(tariff, money, localized)).toBe('Single 40 EGP · Multi 60 EGP')
    expect(tariffLine({ roundingMinutes: 15, options: [tariff.options![0]] }, money, localized)).toBe('40 EGP')
    expect(tariffLine(null, money, localized)).toBe('')
  })
})

describe('what a stay has cost so far', () => {
  const stay: StayViewModel = {
    id: 7,
    status: STAY_RUNNING,
    startedAt: at(100),
    tariff,
    currentOptionCode: 'multi',
    segments: [
      // An hour and a half on the single rate, then the party grew
      { optionCode: 'single', startTime: at(100), endTime: at(10) },
      { optionCode: 'multi', startTime: at(10) },
    ],
  }

  it('counts the running segment up to this second', () => {
    expect(optionSeconds(stay, 'single', now)).toBe(90 * 60)
    expect(optionSeconds(stay, 'multi', now)).toBe(10 * 60)
    expect(elapsedSeconds(stay, now)).toBe(100 * 60)
  })

  it('rounds to the tariff’s step, halves away from zero', () => {
    expect(roundedHours(0)).toBe(0)
    expect(roundedHours(60)).toBe(0) // a minute is nothing: the step is a quarter of an hour
    expect(roundedHours(7.5 * 60)).toBe(0.25) // and half a step rounds up to one
    expect(roundedHours(90 * 60)).toBe(1.5)
    expect(roundedHours(100 * 60)).toBe(1.75)
    expect(roundedHours(50 * 60, 30)).toBe(1) // a half-hour tariff
  })

  it('prices every rate the stay ran on', () => {
    const estimate = estimateStayCost(stay, now)
    expect(estimate.lines.map((l) => [l.code, l.hours, l.amount])).toEqual([
      ['single', 1.5, 60],
      ['multi', 0.25, 15],
    ])
    expect(estimate.hours).toBe(1.75)
    expect(estimate.amount).toBe(75)
  })

  it('costs nothing before the clock starts', () => {
    const fresh: StayViewModel = { id: 8, status: STAY_RUNNING, tariff, segments: [] }
    expect(elapsedSeconds(fresh, now)).toBe(0)
    expect(estimateStayCost(fresh, now).amount).toBe(0)
  })

  it('reads the billed hours off a stay the server has closed, not the estimate', () => {
    expect(stayBilledHours({ costs: [{ hours: 1.5 }, { hours: 0.25 }] })).toBe(1.75)
    expect(stayBilledHours({})).toBe(0)
  })

  it('is running until it is not', () => {
    expect(isRunning(stay)).toBe(true)
    expect(isRunning({ ...stay, status: STAY_ENDED })).toBe(false)
    expect(isRunning(null)).toBe(false)
  })

  it('offers the room’s people to the customer picker, blanks and all', () => {
    expect(
      stayRoster({
        members: [
          { customerId: 'c1', customerName: 'Laila' },
          { customerId: 'c2', customerName: null },
          { customerName: 'A guest with no account' },
        ],
      }),
    ).toEqual([
      { id: 'c1', name: 'Laila' },
      { id: 'c2', name: '' },
    ])
    expect(stayRoster(null)).toEqual([])
  })
})

describe('a reservation on the floor', () => {
  const requested: ReservationViewModel = { id: 3, status: RESERVATION_REQUESTED, isHolding: true }

  it('is open while somebody is on their way or due later', () => {
    expect(isOpenReservation(requested)).toBe(true)
    expect(isOpenReservation({ ...requested, status: RESERVATION_CONFIRMED })).toBe(true)
    expect(isOpenReservation({ ...requested, status: RESERVATION_CANCELLED })).toBe(false)
    expect(isOpenReservation(null)).toBe(false)
  })

  it('holds the place only when it is for now', () => {
    expect(isHolding(requested)).toBe(true)
    expect(isHolding({ ...requested, isHolding: false })).toBe(false)
    expect(isHolding({ ...requested, status: RESERVATION_CANCELLED })).toBe(false)
  })

  it('counts down to lapsing, and never past zero', () => {
    expect(expiresInSeconds({ ...requested, expiresAt: at(-5) }, now)).toBe(300)
    expect(expiresInSeconds({ ...requested, expiresAt: at(5) }, now)).toBe(0)
    expect(expiresInSeconds(requested, now)).toBeNull()
  })
})

describe('the clock on the screen', () => {
  it('reads hh:mm:ss, padded, and never backwards', () => {
    expect(formatClock(0)).toBe('00:00:00')
    expect(formatClock(59)).toBe('00:00:59')
    expect(formatClock(3661)).toBe('01:01:01')
    expect(formatClock(36_000)).toBe('10:00:00')
    expect(formatClock(-10)).toBe('00:00:00')
  })
})
