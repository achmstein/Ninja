import { describe, expect, it } from 'vitest'
import {
  drainSales,
  provisionalNumber,
  ReplayError,
  replaySettleBody,
  type OfflineSale,
  type ReplayApi,
} from './offline-replay'

const sale = (id: string, extra: Partial<OfflineSale> = {}): OfflineSale => ({
  id,
  settleRequestId: `${id}-settle`,
  placedAt: '2026-10-14T09:30:00.000Z',
  branchId: 3,
  provisionalReceiptNumber: provisionalNumber(1),
  lines: [
    {
      productId: 7,
      nameEn: 'Latte',
      nameAr: 'لاتيه',
      price: 50,
      quantity: 2,
      customizations: [],
    },
  ],
  note: '',
  customerName: null,
  payments: [{ tender: 0, tenderName: 'Cash', amount: 100 }],
  subtotal: 100,
  vat: 0,
  vatRate: 0,
  vatIncluded: false,
  total: 100,
  change: 0,
  status: 'queued',
  error: null,
  orderId: null,
  ticketId: null,
  ...extra,
})

class NetworkDown extends Error {}
const refused = Object.assign(new Error('400'), { response: { status: 400 } })

/** A fake server: records the calls, answers from the tables given */
function fakeApi(options: {
  orderIds?: Record<string, number | Error>
  tickets?: Record<number, (number | null | Error)[]>
  settle?: Record<number, Error>
} = {}) {
  const calls: string[] = []
  const api: ReplayApi = {
    createOrder: async (s) => {
      calls.push(`order:${s.id}`)
      const answer = options.orderIds?.[s.id] ?? 100
      if (answer instanceof Error) throw answer
      return answer
    },
    ticketByOrder: async (orderId) => {
      calls.push(`ticket:${orderId}`)
      const answers = options.tickets?.[orderId]
      const answer = answers ? (answers.length > 1 ? answers.shift()! : answers[0]) : orderId + 1000
      if (answer instanceof Error) throw answer
      return answer
    },
    settle: async (ticketId) => {
      calls.push(`settle:${ticketId}`)
      const failure = options.settle?.[ticketId]
      if (failure) throw failure
    },
  }
  return { api, calls }
}

/** A store of the sales as drainSales leaves them */
function store(initial: OfflineSale[]) {
  let sales = [...initial]
  return {
    get sales() {
      return sales
    },
    save: async (id: string, next: OfflineSale | null) => {
      sales = next === null ? sales.filter((s) => s.id !== id) : sales.map((s) => (s.id === id ? next : s))
    },
  }
}

const options = (api: ReplayApi, save: (id: string, s: OfflineSale | null) => Promise<void>) => ({
  api,
  save,
  isConnectionError: (e: unknown) => e instanceof NetworkDown,
  describe: (e: unknown) => (e instanceof ReplayError ? `replay:${e.reason}` : 'refused'),
  sleep: async () => {},
  ticketPollMs: 0,
  ticketTimeoutMs: 50,
})

describe('drainSales', () => {
  it('replays order, ticket and settle, in the order sold, and drops each once settled', async () => {
    const queue = store([sale('a'), sale('b')])
    const { api, calls } = fakeApi({ orderIds: { a: 11, b: 12 } })

    const outcome = await drainSales(queue.sales, options(api, queue.save))

    expect(outcome).toBe('done')
    expect(calls).toEqual(['order:a', 'ticket:11', 'settle:1011', 'order:b', 'ticket:12', 'settle:1012'])
    expect(queue.sales).toEqual([])
  })

  it('picks up where a replay stopped: no second order, no second ticket lookup', async () => {
    const queue = store([sale('a', { orderId: 11, ticketId: 21 })])
    const { api, calls } = fakeApi()

    await drainSales(queue.sales, options(api, queue.save))

    expect(calls).toEqual(['settle:21'])
    expect(queue.sales).toEqual([])
  })

  it('keeps the progress made when the network drops halfway, and stops everything behind it', async () => {
    const queue = store([sale('a'), sale('b')])
    const { api, calls } = fakeApi({
      orderIds: { a: 11 },
      settle: { 1011: new NetworkDown() },
    })

    const outcome = await drainSales(queue.sales, options(api, queue.save))

    expect(outcome).toBe('offline')
    expect(calls).toEqual(['order:a', 'ticket:11', 'settle:1011'])
    // Still queued, with the order and ticket it already has
    expect(queue.sales[0]).toMatchObject({ id: 'a', status: 'queued', orderId: 11, ticketId: 1011 })
    expect(queue.sales[1]).toMatchObject({ id: 'b', status: 'queued', orderId: null })
  })

  it('marks a sale the server refuses as failed, with why, and goes on with the rest', async () => {
    const queue = store([sale('a'), sale('b')])
    const { api, calls } = fakeApi({ orderIds: { a: refused, b: 12 } })

    const outcome = await drainSales(queue.sales, options(api, queue.save))

    expect(outcome).toBe('done')
    expect(calls).toEqual(['order:a', 'order:b', 'ticket:12', 'settle:1012'])
    expect(queue.sales).toEqual([expect.objectContaining({ id: 'a', status: 'failed', error: 'refused' })])
  })

  it('keeps what a refused settle had reached, so a retry only settles', async () => {
    const queue = store([sale('a')])
    const { api } = fakeApi({ orderIds: { a: 11 }, settle: { 1011: refused } })

    await drainSales(queue.sales, options(api, queue.save))

    expect(queue.sales[0]).toMatchObject({ status: 'failed', orderId: 11, ticketId: 1011 })
  })

  it('fails a deduplicated order the server cannot name, for the floor to settle', async () => {
    const queue = store([sale('a')])
    const { api, calls } = fakeApi({ orderIds: { a: 0 } })

    await drainSales(queue.sales, options(api, queue.save))

    expect(calls).toEqual(['order:a'])
    expect(queue.sales[0]).toMatchObject({ status: 'failed', error: 'replay:alreadyPlaced' })
  })

  it('waits for the ticket to appear, then gives up with the order kept', async () => {
    const queue = store([sale('a'), sale('b')])
    const { api } = fakeApi({ orderIds: { a: 11, b: 12 }, tickets: { 11: [null, null, 31], 12: [null] } })

    await drainSales(queue.sales, options(api, queue.save))

    // a: two 404s, then its ticket; b: never, so failed with its order kept
    expect(queue.sales).toEqual([
      expect.objectContaining({ id: 'b', status: 'failed', orderId: 12, error: 'replay:ticketNotReady' }),
    ])
  })

  it('leaves failed sales alone until retried', async () => {
    const queue = store([sale('a', { status: 'failed', error: 'refused' })])
    const { api, calls } = fakeApi()

    await drainSales(queue.sales, options(api, queue.save))

    expect(calls).toEqual([])
    expect(queue.sales).toHaveLength(1)
  })
})

describe('provisionalNumber', () => {
  it('pads to four digits', () => {
    expect(provisionalNumber(1)).toBe('P-0001')
    expect(provisionalNumber(12345)).toBe('P-12345')
  })
})

describe('replaySettleBody', () => {
  it('sends the shift the sale was rung up in', () => {
    expect(replaySettleBody(sale('a', { shiftId: 41 }))).toEqual({
      payments: [{ tender: 0, amount: 100, customerId: null, customerName: null }],
      settledAt: '2026-10-14T09:30:00.000Z',
      provisionalReceiptNumber: 'P-0001',
      shiftId: 41,
    })
  })

  it('leaves the shift out for a sale queued before the till kept it', () => {
    // Stored by an older build: no shiftId key at all
    const legacy = sale('b')
    delete (legacy as Partial<OfflineSale>).shiftId
    const body = replaySettleBody(legacy)
    expect('shiftId' in body).toBe(false)
    expect(body.settledAt).toBe('2026-10-14T09:30:00.000Z')
    expect('shiftId' in replaySettleBody(sale('c', { shiftId: null }))).toBe(false)
  })
})
