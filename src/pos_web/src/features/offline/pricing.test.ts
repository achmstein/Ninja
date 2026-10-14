import { describe, expect, it } from 'vitest'
import { counterBill, NO_PRICING, toPricingRules } from './pricing'

// The same cases as Sales' Ticket.ComputeBill and the Flutter till's
// counterBill: an offline receipt must say what the replayed bill will
describe('counterBill', () => {
  it('adds VAT on top of prices that do not hold it', () => {
    expect(counterBill(100, { vatRate: 0.14, pricesIncludeVat: false, serviceChargeRate: 0 })).toEqual({
      subtotal: 100,
      serviceCharge: 0,
      vat: 14,
      total: 114,
    })
  })

  it('shows the VAT out of prices that already hold it', () => {
    expect(counterBill(100, { vatRate: 0.14, pricesIncludeVat: true, serviceChargeRate: 0 })).toEqual({
      subtotal: 100,
      serviceCharge: 0,
      // 100 − 100 / 1.14 = 12.2807…
      vat: 12.28,
      total: 100,
    })
  })

  it('rounds the VAT to the piastre', () => {
    const bill = counterBill(33.33, { vatRate: 0.14, pricesIncludeVat: false, serviceChargeRate: 0 })
    // 4.6662
    expect(bill.vat).toBe(4.67)
    expect(bill.total).toBeCloseTo(38, 10)
  })

  it('never charges service on a counter sale', () => {
    const bill = counterBill(200, { vatRate: 0, pricesIncludeVat: false, serviceChargeRate: 0.12 })
    expect(bill.serviceCharge).toBe(0)
    expect(bill.total).toBe(200)
  })

  it('bills the plain subtotal with no rules known', () => {
    expect(counterBill(57.5, NO_PRICING)).toEqual({
      subtotal: 57.5,
      serviceCharge: 0,
      vat: 0,
      total: 57.5,
    })
  })
})

describe('toPricingRules', () => {
  it('reads the server pricing view, numbers as strings included', () => {
    expect(
      toPricingRules({ vatRate: '0.14', pricesIncludeVat: true, serviceChargeRate: 0.1 }),
    ).toEqual({ vatRate: 0.14, pricesIncludeVat: true, serviceChargeRate: 0.1 })
  })

  it('falls back to no rules', () => {
    expect(toPricingRules(null)).toEqual(NO_PRICING)
  })
})
