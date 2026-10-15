import { describe, expect, it } from 'vitest'
import { type RangeReport } from '@/api/sales'
import { netStatement, statementAddsUp, tenderSeries } from './report-math'

// A day at a table-service branch with VAT added on top: two bills.
//  Bill 1: lines 200 (a 10 line discount already in) − 20 points = 180,
//          10% bill discount 18, service 12% of 162 = 19.44, VAT 14% of
//          181.44 = 25.40 → 206.84, paid 210 cash, 3.16 change.
//  Bill 2: lines 100 + delivery fee 20 = 120, no discount, counter (no
//          service), VAT 14% = 16.80 → 136.80, paid by card.
// A 50 cash refund on an earlier bill.
const day: RangeReport = {
  ticketsSettled: 2,
  subtotal: 300,
  billDiscounts: 18,
  lineDiscounts: 10,
  loyaltyAndPromo: 20,
  serviceCharge: 19.44,
  vat: 42.2,
  vatAdded: 42.2,
  grossSales: 343.64,
  net: 343.64,
  refunds: 50,
  refundVat: 6.14,
  netSales: 293.64,
  netSalesExVat: 257.58,
  deliveryFees: 20,
  changeGiven: 3.16,
  cashTendered: 210,
  tenderTotals: [
    { tender: 'Cash', amount: 206.84, count: 1, tendered: 210 },
    { tender: 'Card', amount: 136.8, count: 1, tendered: 136.8 },
  ],
  tabPaymentTenderTotals: [{ tender: 'InstaPay', amount: 400, count: 2 }],
}

describe('how net sales is made', () => {
  it('runs line totals → bill discount → service → VAT added → gross → refunds → net, and adds up', () => {
    const lines = netStatement(day)
    expect(lines.map((l) => `${l.sign}${l.key}`)).toEqual([
      'subtotal',
      'oflineDiscounts',
      'ofloyalty',
      'ofdeliveryFees',
      '−billDiscounts',
      '+service',
      '+vatAdded',
      '=gross',
      '−refunds',
      '=net',
      'ofnetExVat',
    ])
    expect(statementAddsUp(lines)).toBe(true)
    expect(lines.find((l) => l.key === 'net')?.amount).toBe(293.64)
  })

  it('adds no VAT where prices include it, and still adds up', () => {
    const included = {
      ...day,
      vatAdded: 0,
      grossSales: 301.44,
      netSales: 251.44,
    }
    const lines = netStatement(included)
    expect(lines.some((l) => l.key === 'vatAdded')).toBe(false)
    expect(statementAddsUp(lines)).toBe(true)
  })

  it('says rounding out loud rather than not adding up', () => {
    const lines = netStatement({ ...day, grossSales: 343.65, netSales: 293.65 })
    expect(lines.find((l) => l.key === 'rounding')).toMatchObject({
      sign: '+',
      amount: 0.01,
    })
    expect(statementAddsUp(lines)).toBe(true)
  })

  it('is just zero lines on an empty day', () => {
    const lines = netStatement(undefined)
    expect(lines.map((l) => l.key)).toEqual(['subtotal', 'gross', 'net'])
    expect(statementAddsUp(lines)).toBe(true)
  })
})

describe('the two tender series', () => {
  it('keeps bills (cash after change) and tab payments apart, bills adding up to gross sales', () => {
    const series = tenderSeries(day, false)
    expect(series.bills.map((r) => r.name)).toEqual([
      'Cash',
      'Card',
      'InstaPay',
      'Account',
    ])
    expect(series.bills.find((r) => r.name === 'Cash')?.amount).toBe(206.84)
    expect(series.billsTotal).toBe(343.64)
    expect(series.tabs).toEqual([
      expect.objectContaining({ name: 'InstaPay', amount: 400, count: 2 }),
    ])
    expect(series.tabsTotal).toBe(400)
  })

  it('offers Online and Talabat only where they apply', () => {
    expect(tenderSeries(day, true).bills.map((r) => r.name)).toContain('Online')
    const talabat = tenderSeries(
      { ...day, tenderTotals: [{ tender: 'Talabat', amount: 90, count: 1 }] },
      false
    )
    expect(talabat.bills.map((r) => r.name)).toContain('Talabat')
    expect(talabat.tabs.length).toBe(1)
  })
})
