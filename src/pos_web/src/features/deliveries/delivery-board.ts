// The board's pure parts: which of its four columns a delivery stands in,
// a column grouped by rider, and how a rider's counted cash is split over
// their bills. Kept apart from the components so they can be tested.
import { laneOf } from './delivery-format'

/**
 * The board's four columns, each a question the cashier asks: who still
 * needs a rider, who is out with whom, what is coming back, and whose cash
 * is still to take in
 */
export type BoardLane = 'waiting' | 'withRiders' | 'comingBack' | 'cashDue'

export const BOARD_LANES: readonly BoardLane[] = ['waiting', 'withRiders', 'comingBack', 'cashDue']

type Boardable = Parameters<typeof laneOf>[0]

/** The column a delivery stands in; null once it is settled (off the board) */
export function boardLaneOf(order: Boardable): BoardLane | null {
  switch (laneOf(order)) {
    case 'waiting':
      return 'waiting'
    case 'withRider':
      return 'withRiders'
    case 'failed':
    case 'returned':
      return 'comingBack'
    case 'cashDue':
      return 'cashDue'
    default:
      return null
  }
}

/** The board's deliveries by column, each in the order the server sent them */
export function byLane<T extends Boardable>(orders: readonly T[]): Record<BoardLane, T[]> {
  const lanes: Record<BoardLane, T[]> = {
    waiting: [],
    withRiders: [],
    comingBack: [],
    cashDue: [],
  }
  for (const order of orders) {
    const lane = boardLaneOf(order)
    if (lane) lanes[lane].push(order)
  }
  return lanes
}

type Riding = {
  delivery?: { riderUserId?: string | null; riderName?: string | null } | null
}

/** One rider's share of a column: their deliveries; null ids for deliveries with no rider named */
export type RiderGroup<T> = {
  riderUserId: string | null
  riderName: string | null
  orders: T[]
}

/** A column by rider: each rider once, in the order their first delivery stands, their deliveries in the column's order */
export function byRider<T extends Riding>(orders: readonly T[]): RiderGroup<T>[] {
  const groups = new Map<string, RiderGroup<T>>()
  for (const order of orders) {
    const key = order.delivery?.riderUserId ?? ''
    let group = groups.get(key)
    if (!group) {
      group = {
        riderUserId: key || null,
        riderName: order.delivery?.riderName ?? null,
        orders: [],
      }
      groups.set(key, group)
    }
    group.orders.push(order)
  }
  return [...groups.values()]
}

/**
 * What each delivery of a rider's hand-in is counted in at, when the cash
 * counted is not what the bills come to. Every bill gets its total; the
 * difference goes on the one the cashier chose (`differenceOn`, else the
 * last): over, on top of it; short, taken from it and, where it is more than
 * that bill, from the others, last first. Never below zero, and to the cent.
 */
export function splitCounted(
  bills: readonly { orderNumber: number; total: number }[],
  counted: number,
  differenceOn?: number | null,
): Map<number, number> {
  const cents = (v: number) => Math.round(v * 100)
  const amounts = new Map(bills.map((b) => [b.orderNumber, cents(b.total)]))
  if (bills.length === 0) return new Map()
  const on = differenceOn != null && amounts.has(differenceOn) ? differenceOn : bills[bills.length - 1].orderNumber
  const difference = cents(counted) - [...amounts.values()].reduce((a, b) => a + b, 0)

  if (difference >= 0) {
    amounts.set(on, amounts.get(on)! + difference)
  } else {
    let short = -difference
    const order = [
      on,
      ...[...bills]
        .reverse()
        .map((b) => b.orderNumber)
        .filter((id) => id !== on),
    ]
    for (const id of order) {
      if (short === 0) break
      const take = Math.min(short, amounts.get(id)!)
      amounts.set(id, amounts.get(id)! - take)
      short -= take
    }
  }
  return new Map([...amounts].map(([id, c]) => [id, c / 100]))
}
