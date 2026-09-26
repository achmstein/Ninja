import { describe, expect, it } from 'vitest'
import { canSettleWith, onlineSummary } from './online-payments'

const paid = (amount: number) => ({ amount, status: 'Paid' })

describe('onlineSummary', () => {
  it('leaves the whole bill to the till when nobody paid online', () => {
    expect(onlineSummary(250, [])).toEqual({
      paid: 0,
      pending: false,
      remaining: 250,
      covered: false,
    })
  })

  it('takes paid shares off the total', () => {
    const s = onlineSummary('300.00', [paid(100), paid(50.5)])
    expect(s.paid).toBe(150.5)
    expect(s.remaining).toBe(149.5)
    expect(s.covered).toBe(false)
  })

  it('ignores pending and refunded payments in the maths but flags pending', () => {
    const s = onlineSummary(100, [
      { amount: 40, status: 'Pending' },
      { amount: 30, status: 'Refunded' },
    ])
    expect(s.paid).toBe(0)
    expect(s.remaining).toBe(100)
    expect(s.pending).toBe(true)
  })

  it('is covered once paid online reaches the total, and never goes negative', () => {
    const s = onlineSummary(99.99, [paid(33.33), paid(33.33), paid(33.33)])
    expect(s.remaining).toBe(0)
    expect(s.covered).toBe(true)
  })

  it('does not trip over float dust', () => {
    const s = onlineSummary(0.3, [paid(0.1), paid(0.2)])
    expect(s.remaining).toBe(0)
  })
})

describe('canSettleWith', () => {
  it('waits while a guest is at the checkout', () => {
    expect(canSettleWith({ pending: true, remaining: 0 }, 0, 0)).toBe(false)
    expect(canSettleWith({ pending: true, remaining: 50 }, 50, 1)).toBe(false)
  })

  it('needs tenders covering only what is left', () => {
    expect(canSettleWith({ pending: false, remaining: 50 }, 49.99, 1)).toBe(false)
    expect(canSettleWith({ pending: false, remaining: 50 }, 50, 1)).toBe(true)
    expect(canSettleWith({ pending: false, remaining: 50 }, 0, 0)).toBe(false)
  })

  it('settles with no tender when online covered it all', () => {
    expect(canSettleWith({ pending: false, remaining: 0 }, 0, 0)).toBe(true)
  })
})
