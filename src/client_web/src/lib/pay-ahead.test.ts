import { describe, expect, it } from 'vitest'
import { payAheadFee } from './pay-ahead'

// What an order paid ahead costs over its total, as Sales works it out (OnlineShares.GuestFee)
describe('payAheadFee', () => {
  it('is nothing where the business carries the fee', () => {
    expect(payAheadFee(200, { feeMode: 'Business', feePercent: 2.75, feeFixed: 3 })).toBe(0)
    expect(payAheadFee(200, undefined)).toBe(0)
  })

  it('covers what the provider keeps where the customer carries it', () => {
    // (200 + 3) / (1 - 0.0275) = 208.74 charged
    expect(payAheadFee(200, { feeMode: 'Guest', feePercent: 2.75, feeFixed: 3 })).toBe(8.74)
  })
})
