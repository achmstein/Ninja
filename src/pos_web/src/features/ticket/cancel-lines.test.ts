import { describe, expect, it } from 'vitest'
import type { TicketLineView } from '@ninja/api/sales/types.gen'
import { isCancellable } from './cancel-lines'

const line = (over: Partial<TicketLineView>): TicketLineView =>
  ({
    id: 1,
    source: 'Order',
    description: { en: 'Burger' },
    qty: 2,
    unitPrice: 100,
    discount: 0,
    total: 200,
    paid: false,
    cancelledQty: 0,
    ...over,
  }) as TicketLineView

describe('isCancellable', () => {
  it('takes an item from the kitchen, and a line keyed in by hand', () => {
    expect(isCancellable(line({}))).toBe(true)
    expect(isCancellable(line({ source: 'Manual' }))).toBe(true)
  })

  it('never takes the time, a delivery fee or money off', () => {
    expect(isCancellable(line({ source: 'SessionTime' }))).toBe(false)
    expect(isCancellable(line({ source: 'DeliveryFee' }))).toBe(false)
    expect(isCancellable(line({ unitPrice: -20, total: -20, qty: 1 }))).toBe(false)
  })

  it('leaves a line already cancelled whole, or paid for, alone', () => {
    expect(isCancellable(line({ qty: 0, cancelledQty: 2, total: 0 }))).toBe(false)
    expect(isCancellable(line({ paid: true }))).toBe(false)
  })

  it('takes what is left of a line partly cancelled', () => {
    expect(isCancellable(line({ qty: 1, cancelledQty: 1, total: 100 }))).toBe(true)
  })
})
