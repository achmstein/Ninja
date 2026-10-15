import { describe, expect, it } from 'vitest'
import { cashierNetSales, categoryRows, itemRows } from './breakdown-rows'
import { drawerSum } from './drawer'

describe('the breakdown’s items', () => {
  const items = itemRows([
    {
      description: { en: 'Latte' },
      qty: 10,
      amount: 600,
      tickets: 8,
      catalogItemId: 1,
      menuAmount: 650,
      refundedQty: 1,
      refundedAmount: 60,
      netQty: 9,
      netAmount: 540,
    },
    {
      description: { en: 'Cake' },
      qty: 4,
      amount: 300,
      tickets: 4,
      catalogItemId: 2,
    },
    {
      description: { en: 'Muffin' },
      qty: 2,
      amount: 80,
      tickets: 2,
      catalogItemId: 3,
    },
  ])

  it('are in paid money less refunds, most first, with the refunded units kept', () => {
    expect(
      items.map((i) => [i.catalogItemId, i.amount, i.qty, i.refundedQty])
    ).toEqual([
      [1, 540, 9, 1],
      [2, 300, 4, 0],
      [3, 80, 2, 0],
    ])
  })

  it('group by category id, not by its name in one language', () => {
    const catalog = [
      {
        id: 1,
        catalogTypeId: 10,
        catalogTypeName: { en: 'Drinks', ar: 'مشروبات' },
      },
      {
        id: 2,
        catalogTypeId: 20,
        catalogTypeName: { en: 'Sweets', ar: 'حلويات' },
      },
      // A second category that happens to read the same in English
      {
        id: 3,
        catalogTypeId: 30,
        catalogTypeName: { en: 'Sweets', ar: 'مخبوزات' },
      },
    ]
    const groups = categoryRows(items, catalog)
    expect(groups.map((g) => [g.id, g.amount, g.refundedQty])).toEqual([
      [10, 540, 1],
      [20, 300, 0],
      [30, 80, 0],
    ])
  })

  it('count an item no longer on the menu as uncategorised', () => {
    expect(categoryRows(items, [])).toEqual([
      { id: null, name: undefined, amount: 920, qty: 15, refundedQty: 1 },
    ])
  })
})

describe('a cashier’s line', () => {
  it('reads net sales, or gross less refunds from an older server', () => {
    expect(
      cashierNetSales({
        name: 'Mona',
        count: 3,
        net: 500,
        discounts: 0,
        voids: 0,
        refunds: 50,
        netSales: 450,
      })
    ).toBe(450)
    expect(
      cashierNetSales({
        name: 'Mona',
        count: 3,
        net: 500,
        discounts: 0,
        voids: 0,
        refunds: 50,
      })
    ).toBe(450)
  })
})

describe('the drawer sum on a shift report', () => {
  it('adds up to expected: float + cash after change + cash tab payments + pay-ins − pay-outs − cash refunds', () => {
    // An 85 bill paid with 100 (15 change), a 40 cash tab payment, 200 in, 50 out, a 30 cash refund
    const sum = drawerSum({
      status: 'Open',
      openingFloat: 500,
      cashTendered: 100,
      changeGiven: 15,
      cashTabPayments: 40,
      payInsTotal: 200,
      payOutsTotal: 50,
      cashRefunds: 30,
      expectedInDrawer: 745,
      tenderTotals: [{ tender: 'Cash', amount: 85, count: 1, tendered: 100 }],
    })
    expect(sum.terms.map((t) => [t.key, t.sign * t.amount])).toEqual([
      ['float', 500],
      ['cash', 85],
      ['tabs', 40],
      ['payIns', 200],
      ['payOuts', -50],
      ['refunds', -30],
    ])
    expect(sum.expected).toBe(745)
    expect(sum.matchesServer).toBe(true)
  })

  it('reads an older server, whose cash tender was what was handed over', () => {
    const sum = drawerSum({
      status: 'Closed',
      openingFloat: 500,
      changeGiven: 15,
      expectedCash: 585,
      tenderTotals: [{ tender: 'Cash', amount: 100, count: 1 }],
    })
    expect(sum.expected).toBe(585)
    expect(sum.matchesServer).toBe(true)
  })
})
