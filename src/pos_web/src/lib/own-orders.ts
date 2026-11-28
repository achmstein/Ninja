import type { AxiosInstance } from 'axios'

/**
 * The orders this till rang up itself, so it can stay quiet about them: the
 * cashier just pressed the button, and a "new order" alert about their own
 * sale is noise that teaches them to ignore the ones that matter. Other tills
 * still hear of it.
 *
 * The news of an order can arrive before the answer to the call that made it,
 * so asking "is this one mine?" waits for any sale still on its way out.
 */
const own = new Set<number>()
let placing = 0
let settled: Array<() => void> = []

/** How long the news waits for a sale in flight before it is taken as someone else's */
const WAIT_MS = 5_000
/** Old numbers are let go: nothing asks about an order from hours ago */
const KEEP = 200

function done() {
  placing = Math.max(0, placing - 1)
  if (placing > 0) return
  const waiting = settled
  settled = []
  waiting.forEach((resolve) => resolve())
}

/** A sale is on its way to the server; call what this returns when it has an answer, with the order's number if it got one */
export function beginPlacing(): (orderId?: number) => void {
  placing++
  let open = true
  return (orderId) => {
    if (!open) return
    open = false
    if (orderId) {
      own.add(orderId)
      if (own.size > KEEP) own.delete(own.values().next().value!)
    }
    done()
  }
}

/** Whether this till rang the order up, once any sale still in flight has answered */
export async function isOwnOrder(orderId: number): Promise<boolean> {
  if (own.has(orderId)) return true
  if (placing === 0) return false
  await Promise.race([
    new Promise<void>((resolve) => settled.push(resolve)),
    new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS)),
  ])
  return own.has(orderId)
}

const isPosOrder = (method?: string, url?: string) =>
  method?.toLowerCase() === 'post' && (url ?? '').split('?')[0].endsWith('/api/orders/pos')

/** Every sale the till sends goes through one client: watched here, whichever screen rang it up */
export function trackOwnOrders(client: AxiosInstance) {
  const open = new WeakMap<object, (orderId?: number) => void>()
  client.interceptors.request.use((config) => {
    if (isPosOrder(config.method, config.url)) open.set(config, beginPlacing())
    return config
  })
  client.interceptors.response.use(
    (response) => {
      open.get(response.config)?.(Number((response.data as { orderId?: number | string } | null)?.orderId) || undefined)
      return response
    },
    (error) => {
      if (error?.config) open.get(error.config)?.()
      return Promise.reject(error)
    }
  )
}
