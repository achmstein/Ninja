import { describe, expect, it } from 'vitest'
import type { TicketDetail } from '@/api/sales/types.gen'
import { totalWith } from './bill'

const ticket = (over: Partial<TicketDetail>): TicketDetail => ({
  type: 'Table',
  lines: [{ source: 'Order', total: 100 }],
  discount: 0,
  discountRate: null,
  serviceChargeRate: 0,
  vatRate: 0,
  vatIncluded: false,
  ...over,
})

// The same arithmetic as Sales' Ticket.ComputeBill: the total the till shows
// while lines are on their way must be the one the server lands on
describe('totalWith', () => {
  it('is the bill as it stands with nothing on its way', () => {
    expect(totalWith(ticket({ vatRate: 0.14 }), 0)).toBe(114)
  })

  it('adds the new lines with their service and VAT on a served bill', () => {
    // 150 menu money, 12% service = 18, VAT 14% of 168 = 23.52
    const total = totalWith(ticket({ serviceChargeRate: 0.12, vatRate: 0.14 }), 50)
    expect(total).toBeCloseTo(191.52, 10)
  })

  it('charges no service at the counter', () => {
    expect(totalWith(ticket({ type: 'Counter', serviceChargeRate: 0.12 }), 50)).toBe(150)
  })

  it('takes a percent discount off the new lines too', () => {
    expect(totalWith(ticket({ discountRate: 0.1, discount: 10 }), 100)).toBe(180)
  })

  it('keeps a fixed discount as it was', () => {
    expect(totalWith(ticket({ discount: 30 }), 100)).toBe(170)
  })

  it('leaves VAT inside prices that already hold it', () => {
    expect(totalWith(ticket({ vatRate: 0.14, vatIncluded: true }), 50)).toBe(150)
  })

  it('charges no service on room time', () => {
    const room = ticket({
      type: 'Room',
      serviceChargeRate: 0.1,
      lines: [
        { source: 'SessionTime', total: 200 },
        { source: 'Order', total: 100 },
      ],
    })
    // Served: 100 + 50 new → 15 service
    expect(totalWith(room, 50)).toBe(365)
  })
})
