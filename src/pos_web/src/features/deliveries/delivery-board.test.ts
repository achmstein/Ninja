import { describe, expect, it } from 'vitest'
import { byLane, byRider, splitCounted } from './delivery-board'

const order = (orderNumber: number, stage = 'Waiting', rider?: string, extra: { cashHandedInAt?: string } = {}) => ({
  orderNumber,
  paidAt: null,
  delivery: {
    stage,
    riderUserId: rider ?? null,
    riderName: rider ? rider.toUpperCase() : null,
    ...extra,
  },
})

describe('the board', () => {
  it('puts each delivery in its column, coming back holding both failed and returned, settled ones off it', () => {
    const lanes = byLane([
      order(1),
      order(2, 'Assigned', 'ali'),
      order(3, 'OnTheWay', 'ali'),
      order(4, 'Failed', 'omar'),
      order(5, 'Returned', 'omar'),
      order(6, 'Delivered', 'ali'),
      order(7, 'Delivered', 'ali', { cashHandedInAt: '2026-10-06T10:00:00Z' }),
    ])
    expect(lanes.waiting.map((o) => o.orderNumber)).toEqual([1])
    expect(lanes.withRiders.map((o) => o.orderNumber)).toEqual([2, 3])
    expect(lanes.comingBack.map((o) => o.orderNumber)).toEqual([4, 5])
    expect(lanes.cashDue.map((o) => o.orderNumber)).toEqual([6])
  })

  it('groups a column by rider, each once in the order they first stand, a delivery with no rider in a group of its own', () => {
    const groups = byRider([
      order(1, 'Delivered', 'ali'),
      order(2, 'Delivered', 'omar'),
      order(3, 'Delivered', 'ali'),
      order(4, 'Delivered'),
    ])
    expect(groups.map((g) => g.riderName)).toEqual(['ALI', 'OMAR', null])
    expect(groups[0].orders.map((o) => o.orderNumber)).toEqual([1, 3])
    expect(groups[2].riderUserId).toBeNull()
  })
})

describe("a rider's hand-in", () => {
  const bills = [
    { orderNumber: 1, total: 120 },
    { orderNumber: 2, total: 80 },
    { orderNumber: 3, total: 45.25 },
  ]
  const split = (counted: number, on?: number) => Object.fromEntries(splitCounted(bills, counted, on))

  it('counted exactly: every bill gets its total', () => {
    expect(split(245.25)).toEqual({ 1: 120, 2: 80, 3: 45.25 })
  })

  it('over: the extra goes on the bill chosen, else the last', () => {
    expect(split(250.25)).toEqual({ 1: 120, 2: 80, 3: 50.25 })
    expect(split(250.25, 1)).toEqual({ 1: 125, 2: 80, 3: 45.25 })
  })

  it('short: taken from the bill chosen, then the others, last first, never below zero', () => {
    expect(split(235.25, 2)).toEqual({ 1: 120, 2: 70, 3: 45.25 })
    expect(split(145.25, 2)).toEqual({ 1: 120, 2: 0, 3: 25.25 })
    expect(split(0)).toEqual({ 1: 0, 2: 0, 3: 0 })
  })

  it('to the cent', () => {
    expect(
      Object.fromEntries(
        splitCounted(
          [
            { orderNumber: 1, total: 0.1 },
            { orderNumber: 2, total: 0.2 },
          ],
          0.3,
        ),
      ),
    ).toEqual({ 1: 0.1, 2: 0.2 })
  })
})
