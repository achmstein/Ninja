import { describe, expect, it } from 'vitest'
import {
  CLOCK_SLACK_MS,
  FOLLOW_FOR_MS,
  LINGER_MS,
  NOT_FOUND_AFTER_MS,
  nextCheck,
  pickOrder,
  pillVisible,
  STAGE_ICON,
  STAGE_LABEL,
  stageOf,
  words,
  type PillOrder,
} from './order-pill'

// The pill that follows an order after Place order: which order it shows,
// what it calls each step, and when it lets go.

const placedAt = Date.parse('2026-09-26T18:00:00Z')
const iso = (msAfterPlaced: number) => new Date(placedAt + msAfterPlaced).toISOString()

describe('stageOf', () => {
  it('is sent while the café has not taken the order on', () => {
    expect(stageOf({ status: 'AwaitingValidation' })).toBe('sent')
    expect(stageOf({ status: 'Submitted' })).toBe('sent')
    expect(stageOf({})).toBe('sent')
  })

  it('is preparing once confirmed', () => {
    expect(stageOf({ status: 'Confirmed' })).toBe('preparing')
  })

  it('is ready when the kitchen says so, paid once the bill is', () => {
    expect(stageOf({ status: 'Confirmed', readyAt: iso(60_000) })).toBe('ready')
    expect(stageOf({ status: 'Confirmed', readyAt: iso(60_000), paidAt: iso(90_000) })).toBe('paid')
  })

  it('is cancelled when turned down or when its bill was voided', () => {
    expect(stageOf({ status: 'Cancelled' })).toBe('cancelled')
    expect(stageOf({ status: 'Confirmed', voidedAt: iso(1) })).toBe('cancelled')
  })

  it('has words in both languages and an icon for every stage', () => {
    for (const stage of ['sent', 'preparing', 'ready', 'paid', 'cancelled'] as const) {
      expect(STAGE_ICON[stage]).toBeTruthy()
      expect(words(STAGE_LABEL[stage], 'en', false)).toMatch(/\w/)
      expect(words(STAGE_LABEL[stage], 'ar', false)).not.toBe(STAGE_LABEL[stage].en)
    }
    expect(words(STAGE_LABEL.preparing, 'ar', true)).toBe('قيد التحضير')
  })
})

describe('pickOrder', () => {
  const orders: PillOrder[] = [
    { orderNumber: 10, date: iso(-60 * 60_000), status: 'Confirmed' },
    { orderNumber: 11, date: iso(1_000), status: 'Submitted' },
    { orderNumber: 12, date: iso(-30_000), status: 'Submitted' },
  ]

  it('follows the newest order placed from the tap on', () => {
    expect(pickOrder(orders, placedAt)?.orderNumber).toBe(11)
  })

  it('allows for the server clock running behind the phone', () => {
    expect(pickOrder([orders[2]], placedAt)?.orderNumber).toBe(12)
    expect(pickOrder([{ orderNumber: 13, date: iso(-CLOCK_SLACK_MS - 1) }], placedAt)).toBeNull()
  })

  it('never picks up an older order', () => {
    expect(pickOrder([orders[0]], placedAt)).toBeNull()
  })

  it('is null until the list has the order, and skips undated rows', () => {
    expect(pickOrder([], placedAt)).toBeNull()
    expect(pickOrder([{ orderNumber: 14 }], placedAt)).toBeNull()
  })
})

describe('pillVisible', () => {
  const base = { placedAt, stageSince: placedAt, dismissed: false }

  it('shows right after the tap, before the order is in the list', () => {
    expect(pillVisible({ ...base, order: null, now: placedAt + 1_000 })).toBe(true)
  })

  it('lets go when the order never turns up', () => {
    expect(pillVisible({ ...base, order: null, now: placedAt + NOT_FOUND_AFTER_MS + 1 })).toBe(false)
  })

  it('stays while the order is sent or preparing', () => {
    const sent = { status: 'Submitted' }
    expect(pillVisible({ ...base, order: sent, now: placedAt + 10 * 60_000 })).toBe(true)
    const preparing = { status: 'Confirmed' }
    expect(pillVisible({ ...base, order: preparing, now: placedAt + 5 * 60_000 })).toBe(true)
  })

  it('goes a while after ready, and soon after paid or cancelled', () => {
    const ready = { status: 'Confirmed', readyAt: iso(1) }
    expect(pillVisible({ ...base, order: ready, now: placedAt + LINGER_MS.ready! - 1 })).toBe(true)
    expect(pillVisible({ ...base, order: ready, now: placedAt + LINGER_MS.ready! + 1 })).toBe(false)
    const paid = { status: 'Confirmed', paidAt: iso(1) }
    expect(pillVisible({ ...base, order: paid, now: placedAt + 1_000 })).toBe(true)
    expect(pillVisible({ ...base, order: paid, now: placedAt + LINGER_MS.paid! + 1 })).toBe(false)
    const cancelled = { status: 'Cancelled' }
    expect(pillVisible({ ...base, order: cancelled, now: placedAt + LINGER_MS.cancelled! + 1 })).toBe(false)
  })

  it('counts the linger from when the stage was reached, not from the tap', () => {
    const paid = { status: 'Confirmed', paidAt: iso(1) }
    const stageSince = placedAt + 10 * 60_000
    expect(pillVisible({ ...base, stageSince, order: paid, now: stageSince + 1_000 })).toBe(true)
  })

  it('goes at once when dismissed, and after the follow window whatever happens', () => {
    expect(pillVisible({ ...base, dismissed: true, order: null, now: placedAt })).toBe(false)
    expect(pillVisible({ ...base, order: { status: 'Submitted' }, now: placedAt + FOLLOW_FOR_MS + 1 })).toBe(false)
  })
})

describe('nextCheck', () => {
  it('is the next moment the pill may go', () => {
    const base = { placedAt, stageSince: placedAt + 1_000, dismissed: false, now: placedAt + 2_000 }
    expect(nextCheck({ ...base, order: null })).toBe(placedAt + NOT_FOUND_AFTER_MS)
    expect(nextCheck({ ...base, order: { paidAt: iso(1) } })).toBe(placedAt + 1_000 + LINGER_MS.paid!)
    expect(nextCheck({ ...base, order: { status: 'Submitted' } })).toBe(placedAt + FOLLOW_FOR_MS)
    expect(nextCheck({ ...base, dismissed: true, order: null })).toBeNull()
  })
})
