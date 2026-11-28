import { setOrderReady, setOrderStationReady } from '@ninja/api/ordering/sdk.gen'

/**
 * Ready / Bring back: for this station's part on a station's screen, for the
 * whole order on the pass. Each carries a fresh idempotency key: a double tap on a
 * slow connection must not turn into two commands (the backend treats a repeat as
 * a no-op anyway).
 */
export async function sendReady(orderNumber: number, ready: boolean, stationId: number | null) {
  const common = {
    body: { ready },
    headers: { 'x-requestid': crypto.randomUUID() },
    throwOnError: true,
  } as const
  if (stationId != null) {
    await setOrderStationReady({ ...common, path: { orderId: orderNumber, stationId } })
  } else {
    await setOrderReady({ ...common, path: { orderId: orderNumber } })
  }
}
