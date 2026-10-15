import { describe, expect, it } from 'vitest'
import type { ShiftView } from '@/api/sales/types.gen'
import { drawerFormula } from './drawer'

// A shift as Sales works it out: float 500; a bill of 85 paid with 100 cash
// (15 change) and one of 120 on card; 40 cash against a tab; a pay-in of 50,
// a pay-out of 30; a cash refund of 20 and a card one of 10
const open: ShiftView = {
  id: 7,
  status: 'Open',
  openingFloat: 500,
  grossSales: 205,
  netSales: 175,
  tenderTotals: [
    { tender: 'Cash', amount: 85, tendered: 100, count: 1 },
    { tender: 'Card', amount: 120, count: 1 },
  ],
  cashTendered: 100,
  changeGiven: 15,
  refundsTotal: 30,
  cashRefunds: 20,
  cashTabPayments: 40,
  payInsTotal: 50,
  payOutsTotal: 30,
  expectedInDrawer: 500 + 100 - 15 + 40 + 50 - 30 - 20,
}

describe('drawerFormula', () => {
  it('lays the drawer out in terms that add up to the expected cash', () => {
    const drawer = drawerFormula(open)
    expect(drawer.terms.map((t) => [t.key, t.sign * t.amount])).toEqual([
      ['openingFloat', 500],
      ['cashTakenNet', 85],
      ['cashTabPayments', 40],
      ['payInsTotal', 50],
      ['payOutsTotal', -30],
      ['cashRefunds', -20],
    ])
    expect(drawer.expected).toBe(625)
    expect(drawer.expected).toBe(Number(open.expectedInDrawer))
    expect(drawer.lateCash).toBe(0)
    expect(drawer.adjustedOverShort).toBeNull()
  })

  it('takes amounts sent as strings', () => {
    const drawer = drawerFormula({
      ...open,
      openingFloat: '500.00',
      cashTendered: '100.50',
      changeGiven: '0.25',
    })
    expect(drawer.terms[1].amount).toBe(100.25)
    expect(drawer.expected).toBe(640.25)
  })

  it('falls back to the cash tender on a server without cashTendered', () => {
    const { cashTendered: _, ...older } = open
    expect(
      drawerFormula({
        ...older,
        tenderTotals: [{ tender: 'Cash', amount: 100, count: 1 }],
      }).expected
    ).toBe(625)
  })

  it('shows the late cash and the adjusted verdict on a closed shift', () => {
    const drawer = drawerFormula({
      ...open,
      status: 'Closed',
      expectedCash: 600,
      closingCount: 620,
      overShort: 20,
      lateCash: 25,
      adjustedOverShort: -5,
    })
    expect(drawer.lateCash).toBe(25)
    expect(drawer.adjustedOverShort).toBe(-5)
  })
})
