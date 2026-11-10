import { create } from 'zustand'
import { brandById, itemById, type Brand, type BrandId } from './menu'

/**
 * The café the page runs: one store that every screen on the page reads, so
 * an order sent from the phone is the same order the till takes, the kitchen
 * makes and the dashboard counts. Times are milliseconds since the page woke,
 * given by whoever acts, so the rules can be tried without a clock.
 */
export type Stage = 'sent' | 'making' | 'ready'

export type Line = { id: string; qty: number }

export type Order = {
  /** What the screens key it by; never changes */
  key: number
  /** Its number, or null while it has only the till's own provisional receipt */
  no: number | null
  /** The receipt a sale made with the line down carries until it is sent: P-0001 */
  provisional: string | null
  lines: Line[]
  total: number
  stage: Stage
  from: 'phone' | 'till'
  where: string
  sentAt: number
  readyAt: number | null
}

/** Points on every pound spent, as the apps give them */
export const POINTS_PER_POUND = 2

export const TIERS = [
  { id: 'bronze', from: 0 },
  { id: 'silver', from: 1000 },
  { id: 'gold', from: 5000 },
  { id: 'platinum', from: 10000 },
] as const

export type TierId = (typeof TIERS)[number]['id']

/** The tier a lifetime total sits in, and how far it is towards the next (1 at the top) */
export function tierOf(lifetime: number): { tier: TierId; next: TierId | null; progress: number } {
  let i = 0
  while (i + 1 < TIERS.length && lifetime >= TIERS[i + 1].from) i++
  const next = TIERS[i + 1]
  if (!next) return { tier: TIERS[i].id, next: null, progress: 1 }
  return { tier: TIERS[i].id, next: next.id, progress: (lifetime - TIERS[i].from) / (next.from - TIERS[i].from) }
}

export const linesTotal = (lines: Line[]) => lines.reduce((sum, l) => sum + itemById(l.id).price * l.qty, 0)
export const linesCount = (lines: Line[]) => lines.reduce((sum, l) => sum + l.qty, 0)

/** One more or one fewer of an item on a list of lines; a line at none is dropped */
export function changeLine(lines: Line[], id: string, by: number): Line[] {
  const has = lines.find((l) => l.id === id)
  if (!has) return by > 0 ? [...lines, { id, qty: by }] : lines
  return lines.map((l) => (l.id === id ? { ...l, qty: l.qty + by } : l)).filter((l) => l.qty > 0)
}

export type CafeState = {
  brand: BrandId
  /** What the guest has picked and not yet sent */
  cart: Line[]
  /** What the cashier has rung up and not yet charged */
  sale: Line[]
  orders: Order[]
  nextKey: number
  nextNo: number
  nextProvisional: number
  /** The till's line to the café's server */
  online: boolean
  /** The guest's points, all they have ever earned */
  points: number
  salesToday: number
  ordersToday: number
  /** What guests have asked for from their tables, newest last */
  requests: Request[]
  /** Whether the owner has had the assistant add its dish to the menu */
  added: boolean
  /** Whether a person, not the page, has used a screen yet */
  touched: boolean
}

export type RequestKind = 'waiter' | 'bill'
export type Request = { key: number; kind: RequestKind; where: string; at: number }

export type CafeActions = {
  setBrand: (brand: BrandId) => void
  touch: () => void
  addToCart: (id: string, by?: number) => void
  /** The guest sends the cart: the order waits at the till. Null with nothing picked */
  placeOrder: (now: number) => Order | null
  /** The till takes a guest's order: it goes to the kitchen and onto the day's sales */
  accept: (key: number, now: number) => void
  /** The kitchen says an order is ready; a guest's order earns its points */
  bump: (key: number, now: number) => void
  /** The kitchen takes a ready order back */
  bringBack: (key: number) => void
  ring: (id: string, by?: number) => void
  /** The cashier charges the sale. With the line down it keeps a provisional receipt and waits */
  charge: (now: number) => Order | null
  /** The line drops or comes back; back, every waiting sale is sent, numbered and counted */
  setOnline: (online: boolean, now: number) => void
  /** Someone walks up to the counter: a sale the page rings by itself, the cashier's own left alone */
  walkIn: (lines: Line[], now: number) => void
  /** A guest asks for a waiter or the bill; the same ask twice is one */
  request: (kind: RequestKind, now: number) => void
  /** Staff have seen to a request */
  answer: (key: number) => void
  /** The assistant adds its dish to the menu */
  addDish: () => void
  /** Orders that have sat ready a while leave the screens */
  clearServed: (now: number) => void
  reset: () => void
}

/** How long a ready order stays on show, in ms */
export const SERVED_AFTER = 9000

export const TABLE = 'Table 3'

/** The day so far when the page wakes: a few orders already in the kitchen, sales on the board */
export function opening(): CafeState {
  return {
    brand: 'mellow',
    cart: [],
    sale: [],
    orders: [
      order(1, 40, [{ id: 'mocha', qty: 2 }, { id: 'cake', qty: 1 }], 'making', 'phone', 'Table 7', -214_000),
      order(2, 41, [{ id: 'flatwhite', qty: 2 }], 'making', 'till', 'Counter', -65_000),
    ],
    nextKey: 3,
    nextNo: 42,
    nextProvisional: 1,
    online: true,
    points: 4690,
    salesToday: 18_450,
    ordersToday: 96,
    requests: [],
    added: false,
    touched: false,
  }
}

function order(key: number, no: number | null, lines: Line[], stage: Stage, from: Order['from'], where: string, sentAt: number): Order {
  return { key, no, provisional: null, lines, total: linesTotal(lines), stage, from, where, sentAt, readyAt: null }
}

/** A sale at the counter: numbered and counted with the line up, on a provisional receipt and waiting with it down */
function sell(s: CafeState, lines: Line[], now: number): { sold: Order; next: Partial<CafeState> } {
  const sold = order(s.nextKey, s.online ? s.nextNo : null, lines, 'making', 'till', 'Counter', now)
  if (!s.online) {
    sold.provisional = `P-${String(s.nextProvisional).padStart(4, '0')}`
    return { sold, next: { orders: [...s.orders, sold], nextKey: s.nextKey + 1, nextProvisional: s.nextProvisional + 1 } }
  }
  return {
    sold,
    next: {
      orders: [...s.orders, sold],
      nextKey: s.nextKey + 1,
      nextNo: s.nextNo + 1,
      salesToday: s.salesToday + sold.total,
      ordersToday: s.ordersToday + 1,
    },
  }
}

export const useCafe = create<CafeState & CafeActions>((set, get) => ({
  ...opening(),
  setBrand: (brand) => set({ brand, cart: [], sale: [] }),
  touch: () => set((s) => (s.touched ? s : { touched: true })),
  addToCart: (id, by = 1) => set((s) => ({ cart: changeLine(s.cart, id, by) })),
  placeOrder: (now) => {
    const s = get()
    if (s.cart.length === 0) return null
    const placed = order(s.nextKey, s.nextNo, s.cart, 'sent', 'phone', TABLE, now)
    set({ cart: [], orders: [...s.orders, placed], nextKey: s.nextKey + 1, nextNo: s.nextNo + 1 })
    return placed
  },
  accept: (key, now) =>
    set((s) => {
      const taken = s.orders.find((o) => o.key === key && o.stage === 'sent')
      if (!taken) return s
      return {
        orders: s.orders.map((o) => (o === taken ? { ...o, stage: 'making', sentAt: now } : o)),
        salesToday: s.salesToday + taken.total,
        ordersToday: s.ordersToday + 1,
      }
    }),
  bump: (key, now) =>
    set((s) => {
      const made = s.orders.find((o) => o.key === key && o.stage === 'making')
      if (!made) return s
      return {
        orders: s.orders.map((o) => (o === made ? { ...o, stage: 'ready', readyAt: now } : o)),
        points: s.points + (made.from === 'phone' ? made.total * POINTS_PER_POUND : 0),
      }
    }),
  bringBack: (key) =>
    set((s) => {
      const back = s.orders.find((o) => o.key === key && o.stage === 'ready')
      if (!back) return s
      return {
        orders: s.orders.map((o) => (o === back ? { ...o, stage: 'making', readyAt: null } : o)),
        points: s.points - (back.from === 'phone' ? back.total * POINTS_PER_POUND : 0),
      }
    }),
  ring: (id, by = 1) => set((s) => ({ sale: changeLine(s.sale, id, by) })),
  charge: (now) => {
    const s = get()
    if (s.sale.length === 0) return null
    const { sold, next } = sell(s, s.sale, now)
    set({ ...next, sale: [] })
    return sold
  },
  walkIn: (lines, now) => set((s) => sell(s, lines, now).next),
  request: (kind, now) =>
    set((s) =>
      s.requests.some((r) => r.kind === kind && r.where === TABLE)
        ? s
        : { requests: [...s.requests, { key: s.nextKey, kind, where: TABLE, at: now }], nextKey: s.nextKey + 1 }
    ),
  addDish: () => set({ added: true }),
  answer: (key) => set((s) => ({ requests: s.requests.filter((r) => r.key !== key) })),
  setOnline: (online, now) =>
    set((s) => {
      if (!online || s.online) return { online }
      // Back on: each waiting sale goes up in the order it was made
      let nextNo = s.nextNo
      let sales = s.salesToday
      let count = s.ordersToday
      const orders = s.orders.map((o) => {
        if (o.no !== null) return o
        sales += o.total
        count += 1
        return { ...o, no: nextNo++, sentAt: now }
      })
      return { online, orders, nextNo, salesToday: sales, ordersToday: count }
    }),
  clearServed: (now) =>
    set((s) => {
      const orders = s.orders.filter((o) => !(o.stage === 'ready' && o.readyAt !== null && now - o.readyAt >= SERVED_AFTER))
      return orders.length === s.orders.length ? s : { orders }
    }),
  reset: () => set(opening()),
}))

/** Sales made with the line down that have not been sent yet */
export const waiting = (orders: Order[]) => orders.filter((o) => o.no === null)

/** What the kitchen sees: orders being made or just ready that the server knows of, oldest first */
export const kitchenOrders = (orders: Order[]) => orders.filter((o) => o.stage !== 'sent' && o.no !== null)

/** Guests' orders the till has not taken yet */
export const incoming = (orders: Order[]) => orders.filter((o) => o.stage === 'sent')

/** The guest's own latest order still on the go, for the phone's dock */
export const guestOrder = (orders: Order[]) => [...orders].reverse().find((o) => o.from === 'phone' && o.where === TABLE)

/** The business on show, with its menu as it stands */
export const useBrand = (): Brand => {
  const id = useCafe((s) => s.brand)
  const added = useCafe((s) => s.added)
  return brandById(id, added)
}
