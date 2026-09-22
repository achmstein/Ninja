import { describe, expect, it } from 'vitest'
import { type PlaceViewModel } from '@/api/spaces'
import { PLACE_ROOM, PLACE_TABLE } from '@/lib/places'
import { bookablePlaces, seatOf, visitTabVisible } from './visit'

// What the customer's bottom bar decides for itself (docs/visit-tab.html):
// what there is to book, and whether the second tab is there at all. The
// café's switches are the plan clamped to what the owner turned on, so a
// place that kept its rate from a bigger plan must not be offered.

const room: PlaceViewModel = { id: 1, kind: PLACE_ROOM, isTimed: true, reservable: true, isActive: true }
const bookableTable: PlaceViewModel = { id: 2, kind: PLACE_TABLE, isTimed: false, reservable: true, isActive: true }
const plainTable: PlaceViewModel = { id: 3, kind: PLACE_TABLE, isTimed: false, reservable: false, isActive: true }
const closedRoom: PlaceViewModel = { id: 4, kind: PLACE_ROOM, isTimed: true, reservable: true, isActive: false }

const everything = { reservations: true, timeBilling: true }

describe('what there is to book', () => {
  const floor = [room, bookableTable, plainTable, closedRoom]

  it('is the timed places and the tables the owner opened to bookings', () => {
    expect(bookablePlaces(floor, everything).map((p) => p.id)).toEqual([1, 2])
  })

  it('leaves out a place taken out of service', () => {
    expect(bookablePlaces(floor, everything).map((p) => p.id)).not.toContain(4)
  })

  it('leaves out the clock when the café does not bill time', () => {
    // The room keeps its rate; with the clock off it is a plain table, and
    // tapping it would only reach a service that refuses
    expect(bookablePlaces(floor, { reservations: true, timeBilling: false }).map((p) => p.id)).toEqual([1, 2])
    expect(bookablePlaces([room], { reservations: false, timeBilling: false })).toEqual([])
  })

  it('leaves out the bookings when the café does not take them', () => {
    expect(bookablePlaces(floor, { reservations: false, timeBilling: true }).map((p) => p.id)).toEqual([1])
  })

  it('is empty for a café that sells neither, whatever its floor looks like', () => {
    expect(bookablePlaces(floor, { reservations: false, timeBilling: false })).toEqual([])
  })
})

describe('the second tab', () => {
  it('is there when the café books something and has something to book', () => {
    expect(visitTabVisible(true, everything)).toBe(true)
    expect(visitTabVisible(true, { reservations: true, timeBilling: false })).toBe(true)
    expect(visitTabVisible(true, { reservations: false, timeBilling: true })).toBe(true)
  })

  it('is gone when the plan has neither the clock nor the bookings', () => {
    expect(visitTabVisible(true, { reservations: false, timeBilling: false })).toBe(false)
  })

  it('is gone when there is nothing to book: a café of plain tables has no tab', () => {
    expect(visitTabVisible(false, everything)).toBe(false)
  })
})

describe('where the customer is sitting', () => {
  const stay = { id: 9, placeId: 1 }
  const scanned = { id: 3, name: 'Table 3' } as never

  it('is the clock, wherever else they have been', () => {
    expect(seatOf(stay, scanned)).toEqual({ kind: 'stay', stay })
  })

  it('is the table they scanned when no clock runs', () => {
    expect(seatOf(null, scanned)).toEqual({ kind: 'table', place: scanned })
  })

  it('is nothing at all before either', () => {
    expect(seatOf(null, null)).toEqual({ kind: 'none' })
    expect(seatOf(undefined, undefined)).toEqual({ kind: 'none' })
  })
})
