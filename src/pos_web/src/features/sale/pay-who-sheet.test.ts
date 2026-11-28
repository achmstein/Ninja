import { describe, expect, it } from 'vitest'
import { payersOf } from './pay-who-sheet'

const line = (id: number, total: number, customerId: string | null, customerName: string | null, source = 'Order') =>
  ({ id, total, qty: 1, customerId, customerName, source }) as never

describe('payersOf', () => {
  it('gives each person their lines, and the bill its own that were for nobody', () => {
    const payers = payersOf([
      line(1, 60, 'a', 'Mona Ali'),
      line(2, 50, 'b', 'Ahmed Hassan'),
      line(3, 85, 'a', 'Mona Ali'),
      line(4, 30, null, null),
      line(5, 40, null, 'Ziad'),
    ])
    expect(payers.map((p) => [p.name, p.lineIds, p.subtotal])).toEqual([
      ['Mona Ali', [1, 3], 145],
      ['Ahmed Hassan', [2], 50],
      [null, [4], 30],
      ['Ziad', [5], 40],
    ])
  })

  it("leaves the room's time with the bill: it is nobody's part to carry off", () => {
    const payers = payersOf([line(1, 60, 'a', 'Mona Ali'), line(2, 180, null, null, 'SessionTime')])
    expect(payers).toHaveLength(1)
    expect(payers[0].lineIds).toEqual([1])
  })
})
