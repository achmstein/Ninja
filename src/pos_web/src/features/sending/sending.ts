import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PosOrderRequest } from '@/api/ordering/types.gen'
import type { SaleCustomer, SaleLine } from '@/features/sale/cart'
import { API_VERSION, apiClient } from '@/lib/api-client'
import { translate } from '@/lib/i18n'
import { isConnectionError } from '@/lib/network-status'
import { problemMessage } from '@/lib/problem'

/** How long a charge waits for the server before it is called not sent */
const SEND_TIMEOUT_MS = 20_000

/**
 * - `sending`: the order is on its way to the server
 * - `placed`: the server took it; the ticket has not shown its lines yet
 * - `failed`: it never got in, and waits for the cashier to retry or remove it
 */
export type SendStatus = 'sending' | 'placed' | 'failed'

/**
 * A charge the till has already shown on the bill but the server has not
 * confirmed yet: lines added to an open ticket, or a new counter sale
 * whose ticket does not exist yet. Kept on the device, so a reload or a
 * dropped connection never loses one; the request id makes sending it
 * again safe (the server recognises a repeat and does not sell it twice).
 */
export type Sending = {
  /** The order's idempotency key, and this entry's id */
  requestId: string
  /** The bill the lines go onto; null for a new counter sale */
  ticketId: number | null
  /** Where it was rung up: a retry goes there whatever branch the till shows by then */
  branchId: number | null
  lines: SaleLine[]
  /** The pad's note and customer, to put the sale back on the pad if the cashier wants it there */
  note: string
  customer: SaleCustomer | null
  body: PosOrderRequest
  status: SendStatus
  orderId: number | null
  /** What the cashier is told when it failed */
  error: string | null
  /** The connection, not the server, stopped it: a counter sale can still be taken offline */
  offline: boolean
  /** When it was sent, or placed once it is: what the timeouts count from */
  startedAt: number
}

/** How long a line that just landed keeps its tick */
const LANDED_MS = 1_500
/**
 * Past this, a placed order whose lines never showed is let go: it is in,
 * and its bill catches up over SignalR or the floor's own refresh
 */
export const PLACED_TIMEOUT_MS = 15_000

type SendingState = {
  sends: Sending[]
  /** Orders whose lines have just landed on their bill, ticked for a moment */
  landed: number[]
}

export const useSending = create<SendingState>()(
  persist(() => ({ sends: [] as Sending[], landed: [] as number[] }), {
    name: 'ninja-pos-sending',
    partialize: (s) => ({ sends: s.sends }),
  }),
)

const patch = (requestId: string, change: Partial<Sending>) =>
  useSending.setState((s) => ({
    sends: s.sends.map((x) => (x.requestId === requestId ? { ...x, ...change } : x)),
  }))

/** Takes a send off the till: removed by the cashier, or let go */
export function dropSend(requestId: string) {
  useSending.setState((s) => ({
    sends: s.sends.filter((x) => x.requestId !== requestId),
  }))
}

/** Its lines are on the bill: the send goes, and they are ticked for a moment */
export function landSend(requestId: string, orderId: number) {
  useSending.setState((s) => ({
    sends: s.sends.filter((x) => x.requestId !== requestId),
    landed: [...s.landed, orderId],
  }))
  setTimeout(
    () => useSending.setState((s) => ({ landed: s.landed.filter((id) => id !== orderId) })),
    LANDED_MS,
  )
}

/**
 * Picks up where a reload left the sends: one still on its way is sent
 * again (the request id makes that safe), and one placed long ago is let go.
 * Run once, when the till opens.
 */
export function resumeSends() {
  for (const send of useSending.getState().sends) {
    if (send.status === 'sending') void sendOrder(send.requestId)
  }
  sweepSends()
}

/** Lets go of placed orders whose lines never showed in time */
export function sweepSends() {
  const now = Date.now()
  for (const send of useSending.getState().sends) {
    if (send.status === 'placed' && now - send.startedAt > PLACED_TIMEOUT_MS) {
      dropSend(send.requestId)
    }
  }
}

/**
 * Remembers how the customer had their items customized, so the pad
 * prefills it next time — what the customer app does for its own orders.
 * Fire-and-forget: a failure only means no prefill.
 */
export function saveCustomerPreferences(customerId: string, lines: SaleLine[]) {
  const byProduct = new Map<number, { customizationId: number; optionId: number }[]>()
  for (const line of lines) {
    if (!line.customizations?.length) continue
    // Last line for a product wins, matching the app's last-order-wins rule
    byProduct.set(
      line.productId,
      line.customizations.map((c) => ({
        customizationId: c.customizationId,
        optionId: c.optionId,
      })),
    )
  }
  if (byProduct.size === 0) return
  const items = [...byProduct.entries()].map(([catalogItemId, selectedOptions]) => ({
    catalogItemId,
    selectedOptions,
  }))
  apiClient
    .post(`/api/catalog/customers/${customerId}/preferences`, { items })
    .catch(() => {})
}

/** What happened to one attempt; the store already says so too */
export type SendOutcome =
  | { kind: 'placed'; orderId: number }
  | { kind: 'alreadyPlaced' }
  | { kind: 'failed' }

/** Sends (or sends again) one charge, keeping its state in the store as it goes */
export async function sendOrder(requestId: string): Promise<SendOutcome> {
  const send = useSending.getState().sends.find((x) => x.requestId === requestId)
  if (!send) return { kind: 'failed' }
  patch(requestId, { status: 'sending', error: null, offline: false })
  try {
    const { data } = await apiClient.post<{ orderId: number | string }>(
      '/api/orders/pos',
      send.body,
      {
        params: { 'api-version': API_VERSION },
        headers: {
          'x-requestid': send.requestId,
          ...(send.branchId != null ? { 'X-Branch-Id': String(send.branchId) } : {}),
        },
        timeout: SEND_TIMEOUT_MS,
      },
    )
    const orderId = Number(data.orderId)
    if (send.customer?.id) saveCustomerPreferences(send.customer.id, send.lines)
    // 0 is a repeat the server recognised: an earlier attempt went in, and
    // its lines are on the bill already
    if (!orderId) {
      dropSend(requestId)
      return { kind: 'alreadyPlaced' }
    }
    patch(requestId, { status: 'placed', orderId, startedAt: Date.now() })
    return { kind: 'placed', orderId }
  } catch (error) {
    const offline = isConnectionError(error)
    patch(requestId, {
      status: 'failed',
      offline,
      error: offline
        ? translate('sendNoConnection')
        : problemMessage(error, translate, 'somethingWentWrong'),
    })
    return { kind: 'failed' }
  }
}

/** Puts a charge on the till and starts sending it */
export function startSend(send: Omit<Sending, 'status' | 'orderId' | 'error' | 'offline' | 'startedAt'>) {
  useSending.setState((s) => ({
    sends: [
      ...s.sends.filter((x) => x.requestId !== send.requestId),
      { ...send, status: 'sending', orderId: null, error: null, offline: false, startedAt: Date.now() },
    ],
  }))
  return sendOrder(send.requestId)
}

/** The sends for this bill, oldest first */
export const sendsFor = (sends: Sending[], ticketId: number) =>
  sends.filter((x) => x.ticketId === ticketId)
