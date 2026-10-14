import type { SaleLine } from '@/features/sale/cart'
import type { TenderName } from '@/features/ticket/tenders'

export type OfflinePayment = {
  /** PaymentTender value (Cash=0, Card=1, InstaPay=2) */
  tender: number
  tenderName: TenderName
  amount: number
}

export type OfflineSaleStatus = 'queued' | 'failed'

/**
 * A counter sale rung up and paid while the server was out of reach:
 * everything the till needs to replay it later exactly as it happened — the
 * lines, who paid what, when, and the number it printed on the customer's
 * receipt. The ids double as idempotency keys, so a replay cut off halfway
 * is retried without selling anything twice. The web twin of the Flutter
 * till's OfflineSale (pos_app/lib/core/offline/offline_sale.dart).
 */
export type OfflineSale = {
  /** The order's idempotency key — the same one an online charge would have used */
  id: string
  settleRequestId: string
  /** ISO time it was sold, which the order and the settle are both dated */
  placedAt: string
  /** Where it was rung up: the replay goes there whatever branch the till shows by then */
  branchId: number | null
  provisionalReceiptNumber: string
  lines: SaleLine[]
  note: string
  /** A name the cashier was told; an offline sale never carries an account */
  customerName: string | null
  payments: OfflinePayment[]
  subtotal: number
  vat: number
  vatRate: number
  vatIncluded: boolean
  total: number
  change: number
  status: OfflineSaleStatus
  error: string | null
  /** Filled in as the replay progresses, so a retry picks up where it stopped */
  orderId: number | null
  ticketId: number | null
}

/** The three calls a replay makes; the real ones are in offline-queue.ts */
export type ReplayApi = {
  /** POST /api/orders/pos as a replay; 0 is a deduplicated retry */
  createOrder: (sale: OfflineSale) => Promise<number>
  /** The ticket the order landed on, or null while it has not yet */
  ticketByOrder: (orderId: number, sale: OfflineSale) => Promise<number | null>
  settle: (ticketId: number, sale: OfflineSale) => Promise<void>
}

export type ReplayOptions = {
  api: ReplayApi
  /** Saves a sale's progress (its new state), or removes it once replayed (null) */
  save: (id: string, sale: OfflineSale | null) => Promise<void>
  isConnectionError: (error: unknown) => boolean
  /** What the cashier is told about a sale the server refused */
  describe: (error: unknown) => string
  sleep?: (ms: number) => Promise<void>
  ticketPollMs?: number
  ticketTimeoutMs?: number
}

/**
 * Why a replay stopped short without the server refusing it; `describe`
 * puts the reason in the till's words
 */
export class ReplayError extends Error {
  readonly reason: 'alreadyPlaced' | 'ticketNotReady'
  constructor(reason: 'alreadyPlaced' | 'ticketNotReady') {
    super(reason)
    this.reason = reason
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Replays one sale: the POS order (dated when it was sold, confirmed on
 * arrival), then the settle against the ticket it opened (dated the same,
 * carrying the provisional number). Each step's result is saved before the
 * next, so a retry picks up after the last one that landed.
 */
export async function replaySale(
  sale: OfflineSale,
  options: ReplayOptions,
): Promise<void> {
  const { api, save } = options
  const sleep = options.sleep ?? defaultSleep
  const pollMs = options.ticketPollMs ?? 600
  const timeoutMs = options.ticketTimeoutMs ?? 12_000

  let current = sale
  if (current.orderId == null) {
    const orderId = await api.createOrder(current)
    // 0 is a deduplicated retry whose id the server could not find again:
    // the order is in, its ticket is on the floor, and only the settle is
    // missing — a person has to do that one
    if (!orderId) throw new ReplayError('alreadyPlaced')
    current = { ...current, orderId }
    await save(current.id, current)
  }

  if (current.ticketId == null) {
    // The counter ticket materializes off the order-confirmed event, so the
    // order → ticket lookup 404s for a moment
    const startedAt = Date.now()
    let ticketId: number | null = null
    for (;;) {
      ticketId = await api.ticketByOrder(current.orderId!, current)
      if (ticketId != null) break
      if (Date.now() - startedAt >= timeoutMs) throw new ReplayError('ticketNotReady')
      await sleep(pollMs)
    }
    current = { ...current, ticketId }
    await save(current.id, current)
  }

  await api.settle(current.ticketId!, current)
}

/**
 * Replays every queued sale in the order it was sold. A sale the server
 * cannot be reached for stops the run (everything behind it waits too); one
 * it refuses is kept as failed, with its reason, for the cashier to look at.
 * Returns whether the run got through or stopped for the network.
 */
export async function drainSales(
  sales: readonly OfflineSale[],
  options: ReplayOptions,
): Promise<'done' | 'offline'> {
  for (const sale of sales) {
    if (sale.status !== 'queued') continue
    // The progress saved so far is the sale the replay continues from
    let latest = sale
    const save = async (id: string, next: OfflineSale | null) => {
      if (next) latest = next
      await options.save(id, next)
    }
    try {
      await replaySale(sale, { ...options, save })
      await options.save(sale.id, null)
    } catch (error) {
      if (options.isConnectionError(error)) return 'offline'
      await options.save(sale.id, {
        ...latest,
        status: 'failed',
        error: options.describe(error),
      })
    }
  }
  return 'done'
}

/** The next provisional receipt number after `last`: P-0001, P-0002, … */
export function provisionalNumber(next: number): string {
  return `P-${String(next).padStart(4, '0')}`
}
