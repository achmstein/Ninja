import { AxiosError } from 'axios'
import { get, update } from 'idb-keyval'
import { create } from 'zustand'
import { getStoredUser } from '@/config/oidc-config'
import { toBasketItems } from '@/features/sale/basket-items'
import { apiClient } from '@/lib/api-client'
import { translate } from '@/lib/i18n'
import { isConnectionError, networkStatus } from '@/lib/network-status'
import { problemMessage } from '@/lib/problem'
import {
  drainSales,
  provisionalNumber,
  ReplayError,
  type OfflineSale,
  type ReplayApi,
} from './offline-replay'

const SALES_KEY = 'pos.offline.sales'
const NEXT_NUMBER_KEY = 'pos.offline.next'
const LOCK_NAME = 'pos-offline-drain'
/** A replayed call that hangs is a till that is not really back */
const REPLAY_TIMEOUT_MS = 30_000

type QueueState = {
  /** The sales rung up while the server was out of reach, oldest first */
  sales: OfflineSale[]
  loaded: boolean
  draining: boolean
}

/**
 * The offline sales, as this tab last read them from IndexedDB. Every
 * change goes through IndexedDB first (a read-modify-write in one
 * transaction), so two tabs of the till never write over each other's
 * sales; the other tabs hear about it on a BroadcastChannel and read again.
 */
export const useOfflineQueue = create<QueueState>()(() => ({
  sales: [],
  loaded: false,
  draining: false,
}))

const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('pos-offline-sales')
    : null
channel?.addEventListener('message', () => {
  void loadOfflineSales()
})

export async function loadOfflineSales(): Promise<OfflineSale[]> {
  let sales: OfflineSale[] = []
  try {
    sales = (await get<OfflineSale[]>(SALES_KEY)) ?? []
  } catch {
    // No IndexedDB (a private window that refuses it): nothing was queued here
  }
  useOfflineQueue.setState({ sales, loaded: true })
  return sales
}

async function change(
  apply: (sales: OfflineSale[]) => OfflineSale[],
): Promise<void> {
  let next: OfflineSale[] = []
  await update<OfflineSale[]>(SALES_KEY, (sales) => {
    next = apply(sales ?? [])
    return next
  })
  useOfflineQueue.setState({ sales: next, loaded: true })
  channel?.postMessage('changed')
}

/** Puts a paid sale in the queue; it is replayed the moment the server is back */
export async function enqueueOfflineSale(sale: OfflineSale): Promise<void> {
  await change((sales) => [...sales.filter((s) => s.id !== sale.id), sale])
}

export async function discardOfflineSale(id: string): Promise<void> {
  await change((sales) => sales.filter((s) => s.id !== id))
}

export async function retryOfflineSale(id: string): Promise<void> {
  await change((sales) =>
    sales.map((s) =>
      s.id === id ? { ...s, status: 'queued', error: null } : s,
    ),
  )
  await drainOfflineSales()
}

/**
 * The next provisional receipt number this till hands out: `P-0001`,
 * `P-0002`, … — printed on the offline receipt and kept by the server beside
 * the real number once the sale is replayed. Counted per device.
 */
export function nextProvisionalReceiptNumber(): string {
  let next = 1
  try {
    next = Number(localStorage.getItem(NEXT_NUMBER_KEY) ?? '0') + 1
    localStorage.setItem(NEXT_NUMBER_KEY, String(next))
  } catch {
    // Storage refused: the time on the receipt still tells the sales apart
  }
  return provisionalNumber(next)
}

const branchHeaders = (sale: OfflineSale) =>
  sale.branchId != null ? { 'X-Branch-Id': String(sale.branchId) } : {}

const replayApi: ReplayApi = {
  createOrder: async (sale) => {
    const { data } = await apiClient.post<{ orderId: number | string }>(
      '/api/orders/pos',
      {
        items: toBasketItems(sale.lines),
        customerNote: sale.note.trim() || null,
        ticketId: null,
        customerUserId: null,
        customerUserName: null,
        customerName: sale.customerName,
        pointsToRedeem: 0,
        delivery: null,
        sendToBranchId: null,
        // Sold back then, confirmed on arrival: nothing for the kitchen to make
        placedAt: sale.placedAt,
        replay: true,
      },
      {
        headers: { 'x-requestid': sale.id, ...branchHeaders(sale) },
        timeout: REPLAY_TIMEOUT_MS,
      },
    )
    return Number(data.orderId)
  },
  ticketByOrder: async (orderId, sale) => {
    try {
      const { data } = await apiClient.get<{ ticketId: number | string }>(
        `/api/tickets/by-order/${orderId}`,
        { headers: branchHeaders(sale), timeout: REPLAY_TIMEOUT_MS },
      )
      return data?.ticketId != null ? Number(data.ticketId) : null
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return null
      throw error
    }
  },
  settle: async (ticketId, sale) => {
    await apiClient.post(
      `/api/tickets/${ticketId}/settle`,
      {
        payments: sale.payments.map((p) => ({
          tender: p.tender,
          amount: p.amount,
          customerId: null,
          customerName: null,
        })),
        settledAt: sale.placedAt,
        provisionalReceiptNumber: sale.provisionalReceiptNumber,
      },
      {
        headers: { 'x-requestid': sale.settleRequestId, ...branchHeaders(sale) },
        timeout: REPLAY_TIMEOUT_MS,
      },
    )
  },
}

function describe(error: unknown): string {
  if (error instanceof ReplayError) {
    return translate(
      error.reason === 'alreadyPlaced'
        ? 'offlineAlreadyPlaced'
        : 'offlineTicketNotReady',
    )
  }
  return problemMessage(error, translate, 'somethingWentWrong')
}

// Without the Web Locks API (old browsers) a tab at least never runs two at once
let drainingHere = false

async function withDrainLock(run: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    // One tab replays at a time; another asking meanwhile has nothing to add
    await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (lock) await run()
    })
    return
  }
  if (drainingHere) return
  drainingHere = true
  try {
    await run()
  } finally {
    drainingHere = false
  }
}

/**
 * Replays the queued sales, oldest first (offline-replay.ts). Waits for a
 * signed-in session the server will accept: an expired token is renewed by
 * the auth gate first. Returns whether anything was replayed.
 */
export async function drainOfflineSales(): Promise<boolean> {
  const user = getStoredUser()
  if (!user || user.expired) return false
  let replayed = false
  await withDrainLock(async () => {
    // Inside the lock, what is stored is the truth: another tab may have replayed some
    const sales = await loadOfflineSales()
    if (!sales.some((s) => s.status === 'queued')) return
    useOfflineQueue.setState({ draining: true })
    try {
      const outcome = await drainSales(sales, {
        api: replayApi,
        isConnectionError,
        describe,
        save: async (id, next) => {
          if (next === null) replayed = true
          await change((all) =>
            next === null
              ? all.filter((s) => s.id !== id)
              : all.map((s) => (s.id === id ? next : s)),
          )
        },
      })
      if (outcome === 'offline') networkStatus.reportFailure()
    } finally {
      useOfflineQueue.setState({ draining: false })
    }
  })
  return replayed
}

