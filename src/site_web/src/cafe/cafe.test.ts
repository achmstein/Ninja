import { beforeEach, describe, expect, it } from 'vitest'
import { equalSplit, itemsSplit, ROOM_TARIFF, sessionBill } from './bill'
import { BRANDS } from './menu'
import { guestOrder, incoming, kitchenOrders, opening, tierOf, useCafe, waiting } from './store'

const cafe = () => useCafe.getState()

beforeEach(() => cafe().reset())

describe('an order from the phone', () => {
  it('waits at the till, then reaches the kitchen and the day when it is taken', () => {
    const before = opening()
    cafe().addToCart('latte')
    cafe().addToCart('waffle')
    cafe().addToCart('latte')
    const placed = cafe().placeOrder(1000)!
    expect(placed.total).toBe(75 * 2 + 110)
    expect(placed.no).toBe(42)
    expect(cafe().cart).toEqual([])
    expect(incoming(cafe().orders).map((o) => o.key)).toEqual([placed.key])
    expect(kitchenOrders(cafe().orders)).toHaveLength(before.orders.length)
    expect(cafe().salesToday).toBe(before.salesToday)

    cafe().accept(placed.key, 2000)
    expect(incoming(cafe().orders)).toEqual([])
    expect(kitchenOrders(cafe().orders).at(-1)?.key).toBe(placed.key)
    expect(cafe().salesToday).toBe(before.salesToday + 260)
    expect(cafe().ordersToday).toBe(before.ordersToday + 1)
  })

  it('earns its points when the kitchen says ready, and gives them back if it is taken back', () => {
    const before = cafe().points
    cafe().addToCart('latte')
    const placed = cafe().placeOrder(0)!
    cafe().accept(placed.key, 10)
    cafe().bump(placed.key, 20)
    expect(guestOrder(cafe().orders)?.stage).toBe('ready')
    expect(cafe().points).toBe(before + 150)
    cafe().bringBack(placed.key)
    expect(cafe().points).toBe(before)
  })

  it('is not sent with nothing picked, and taking it twice counts once', () => {
    expect(cafe().placeOrder(0)).toBeNull()
    cafe().addToCart('latte')
    const placed = cafe().placeOrder(0)!
    cafe().accept(placed.key, 1)
    const sales = cafe().salesToday
    cafe().accept(placed.key, 2)
    expect(cafe().salesToday).toBe(sales)
  })

  it('leaves the screens a while after it is ready', () => {
    cafe().addToCart('latte')
    const placed = cafe().placeOrder(0)!
    cafe().accept(placed.key, 0)
    cafe().bump(placed.key, 1000)
    cafe().clearServed(5000)
    expect(cafe().orders.some((o) => o.key === placed.key)).toBe(true)
    cafe().clearServed(10_000)
    expect(cafe().orders.some((o) => o.key === placed.key)).toBe(false)
  })
})

describe('the till', () => {
  it('rings a sale straight to the kitchen', () => {
    const before = cafe().salesToday
    cafe().ring('cappuccino')
    cafe().ring('cappuccino')
    cafe().ring('cake')
    cafe().ring('cake', -1)
    const sold = cafe().charge(0)!
    expect(sold.total).toBe(140)
    expect(sold.stage).toBe('making')
    expect(cafe().sale).toEqual([])
    expect(cafe().salesToday).toBe(before + 140)
  })

  it('keeps selling with the line down, on provisional receipts, and sends them when it is back', () => {
    const before = opening()
    cafe().setOnline(false, 0)
    cafe().ring('latte')
    const first = cafe().charge(100)!
    cafe().ring('mocha')
    const second = cafe().charge(200)!
    expect([first.provisional, second.provisional]).toEqual(['P-0001', 'P-0002'])
    expect(first.no).toBeNull()
    expect(waiting(cafe().orders)).toHaveLength(2)
    expect(kitchenOrders(cafe().orders)).toHaveLength(before.orders.length)
    expect(cafe().salesToday).toBe(before.salesToday)

    cafe().setOnline(true, 300)
    expect(waiting(cafe().orders)).toEqual([])
    const sent = cafe().orders.filter((o) => o.provisional)
    expect(sent.map((o) => o.no)).toEqual([42, 43])
    expect(cafe().nextNo).toBe(44)
    expect(cafe().salesToday).toBe(before.salesToday + 75 + 95)
    expect(cafe().ordersToday).toBe(before.ordersToday + 2)
  })
})

describe('a request from a table', () => {
  it('shows once however often it is asked, until staff answer it', () => {
    cafe().request('waiter', 0)
    cafe().request('waiter', 10)
    cafe().request('bill', 20)
    expect(cafe().requests.map((r) => r.kind)).toEqual(['waiter', 'bill'])
    cafe().answer(cafe().requests[0].key)
    expect(cafe().requests.map((r) => r.kind)).toEqual(['bill'])
  })
})

describe('a walk-in', () => {
  it('is sold without touching what the cashier is ringing up', () => {
    cafe().ring('latte')
    cafe().walkIn([{ id: 'cake', qty: 1 }], 0)
    expect(cafe().sale).toEqual([{ id: 'latte', qty: 1 }])
    expect(kitchenOrders(cafe().orders).at(-1)?.total).toBe(120)
  })
})

describe('a bill', () => {
  it('splits equally to shares that add up', () => {
    expect(equalSplit(445, 4)).toEqual([112, 111, 111, 111])
    expect(equalSplit(300, 3)).toEqual([100, 100, 100])
    expect(equalSplit(445, 4).reduce((a, b) => a + b)).toBe(445)
  })

  it('splits by items', () => {
    const lines = [
      { id: 'a', price: 120 },
      { id: 'b', price: 95 },
      { id: 'c', price: 110 },
    ]
    expect(itemsSplit(lines, new Set(['a', 'b']))).toEqual({ share: 215, left: 110 })
  })
})

describe('a room', () => {
  it('bills each rate for its own time, rounded up to the quarter hour', () => {
    const bill = sessionBill(
      [
        { rate: 'single', minutes: 60 },
        { rate: 'multi', minutes: 50 },
      ],
      ROOM_TARIFF
    )
    expect(bill.lines).toEqual([
      { rate: 'single', minutes: 60, amount: 60 },
      { rate: 'multi', minutes: 60, amount: 90 },
    ])
    expect(bill.total).toBe(150)
  })

  it('charges nothing before the clock has run', () => {
    expect(sessionBill([{ rate: 'single', minutes: 0 }], ROOM_TARIFF).total).toBe(0)
  })
})

describe('loyalty', () => {
  it('names the tier and how far the next is', () => {
    expect(tierOf(0).tier).toBe('bronze')
    expect(tierOf(1000).tier).toBe('silver')
    expect(tierOf(3000)).toEqual({ tier: 'silver', next: 'gold', progress: 0.5 })
    expect(tierOf(12_000)).toEqual({ tier: 'platinum', next: null, progress: 1 })
  })
})

describe('the menus', () => {
  it('give every item a name in both languages and a category that exists', () => {
    for (const brand of BRANDS) {
      for (const item of brand.items) {
        expect(item.name.en && item.name.ar && item.note.en && item.note.ar).toBeTruthy()
        expect(brand.categories[item.cat]).toBeDefined()
      }
    }
  })
})
