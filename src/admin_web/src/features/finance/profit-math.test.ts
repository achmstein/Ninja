import { describe, expect, it } from 'vitest'
import { type ProfitView } from '@/api/finance'
import { remainingShare, shareFits } from './partner-shares'
import {
  formatShare,
  oldestFirst,
  profitAddsUp,
  profitBase,
  profitStatement,
  shareOf,
} from './profit-math'

// A month: 11,400 sold, 400 refunded, VAT 1,400 on the sales of which 49.12
// came back with the refunds; goods 3,000, waste 100, a count 60 short,
// wages 2,500, expenses 1,200.
const month: ProfitView = {
  year: 2026,
  month: 10,
  sales: 11400,
  refunds: 400,
  netSales: 11000,
  vat: 1400,
  refundVat: 49.12,
  netVat: 1350.88,
  netSalesExVat: 9649.12,
  goods: 3000,
  waste: 100,
  shrinkage: 60,
  labour: 2500,
  expensesByCategory: [],
  expenses: 1200,
  profit: 2789.12,
  primeCostRatio: null,
  margin: 0.289,
}

describe('the month’s statement', () => {
  it('takes the VAT off before the costs, and every line adds up to profit', () => {
    const lines = profitStatement(month)
    expect(lines.map((l) => `${l.sign}${l.key}`)).toEqual([
      'sales',
      '−refunds',
      '=net',
      '−vat',
      '=exVat',
      '−goods',
      '−waste',
      '−shrinkage',
      '−labour',
      '−expenses',
      '=profit',
    ])
    expect(profitAddsUp(lines)).toBe(true)
  })

  it('shows a stock count that found more as a gain', () => {
    const gain = { ...month, shrinkage: -40, profit: 2889.12 }
    const lines = profitStatement(gain)
    expect(lines.find((l) => l.key === 'shrinkage')).toMatchObject({
      sign: '+',
      amount: 40,
      labelKey: 'stockCountGain',
    })
    expect(profitAddsUp(lines)).toBe(true)
  })

  it('reads an older server (no VAT split) as no VAT taken off', () => {
    const old = {
      ...month,
      netVat: undefined,
      netSalesExVat: undefined,
      refundVat: undefined,
      shrinkage: undefined,
      profit: 4200,
    }
    const lines = profitStatement(old)
    expect(lines.some((l) => l.key === 'vat')).toBe(false)
    expect(profitBase(old)).toBe(11000)
    expect(profitAddsUp(lines)).toBe(true)
  })
})

describe('percentages', () => {
  it('are on net sales ex VAT, uncapped, and absent without a base', () => {
    expect(shareOf(3100, profitBase(month))).toBeCloseTo(0.3213, 3)
    expect(formatShare(shareOf(500, 400), 'en')).toBe('125%')
    expect(shareOf(10, 0)).toBeNull()
    expect(formatShare(null, 'en')).toBeNull()
  })
})

describe('the profit trend', () => {
  it('draws oldest first', () => {
    const months = [
      { year: 2026, month: 2 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]
    expect(oldestFirst(months).map((m) => `${m.year}-${m.month}`)).toEqual([
      '2025-12',
      '2026-1',
      '2026-2',
    ])
  })
})

describe('partner shares', () => {
  const partner = (
    id: number,
    isActive: boolean,
    shares: [number, number][]
  ) => ({
    id,
    name: `P${id}`,
    phone: null,
    userId: null,
    branchIds: shares.map(([b]) => b),
    shares: shares.map(([branchId, percent]) => ({ branchId, percent })),
    isActive,
    balance: 0,
  })
  const partners = [
    partner(1, true, [
      [1, 60],
      [2, 100],
    ]),
    partner(2, true, [[1, 25]]),
    partner(3, false, [[1, 50]]),
  ]

  it('leaves what the other active partners do not hold, never 100 by default', () => {
    expect(remainingShare(partners, 1, null)).toBe(15)
    expect(remainingShare(partners, 2, null)).toBe(0)
    expect(remainingShare(partners, 3, null)).toBe(100)
  })

  it('counts the partner being edited as room they may keep', () => {
    expect(remainingShare(partners, 1, 2)).toBe(40)
  })

  it('refuses a share over what is left', () => {
    expect(shareFits(15, 15)).toBe(true)
    expect(shareFits(15.5, 15)).toBe(false)
    expect(shareFits(-1, 15)).toBe(false)
  })
})
