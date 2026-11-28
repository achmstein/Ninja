import { create } from 'zustand'
import { apiClient, API_VERSION } from '@/lib/api-client'
import { PREVIEW_MINUTES, useDockPreview } from '@/lib/dock-preview'
import { type PillStage } from '@/lib/order-pill'

/** The order on its way, as the dock says it */
export type LiveOrder = {
  stage: PillStage | null
  orderNumber: number | null
  /** About how many minutes are left, for a delivery the server can say it for */
  minutes: number | null
  /** Who is bringing a delivery, and their number while they are */
  riderName: string | null
  riderPhone: string | null
}

const NONE: LiveOrder = { stage: null, orderNumber: null, minutes: null, riderName: null, riderPhone: null }

/**
 * The order the customer is following (components/order-pill.tsx works it
 * out), as the dock shows it: its stage and number while it is worth
 * showing, and for a delivery the minutes left and who is bringing it;
 * nothing otherwise.
 */
export const useLiveOrder = create<LiveOrder>(() => NONE)

/** Nothing is followed any more */
export function clearLiveOrder() {
  useLiveOrder.setState(NONE)
}

/**
 * The order the dock shows: the one followed, or in a development preview
 * the one its panel stands in for (lib/dock-preview), so each of the dock's
 * states is looked at without placing an order.
 */
export function useDockOrder(): LiveOrder {
  const followed = useLiveOrder()
  const preview = useDockPreview()
  if (!preview.on || preview.stage == null) return followed
  return {
    stage: preview.stage,
    orderNumber: 142,
    minutes: PREVIEW_MINUTES[preview.stage] ?? null,
    riderName: preview.stage === 'onTheWay' ? 'Karim' : null,
    riderPhone: preview.stage === 'onTheWay' ? '01000000000' : null,
  }
}

/** A delivery as the server says it live (Ordering's `GET {id}/delivery/live`): never where the rider is */
export type DeliveryLive = {
  stage?: string
  riderName?: string | null
  riderPhone?: string | null
  etaMinutes?: number | null
}

export async function getDeliveryLive(orderId: number): Promise<DeliveryLive | null> {
  try {
    const response = await apiClient.get<DeliveryLive>(`/api/orders/${orderId}/delivery/live`, {
      params: { 'api-version': API_VERSION },
    })
    return response.data ?? null
  } catch {
    // The row says the stage without the minutes
    return null
  }
}

/** The dock's way to pay an order waiting for its payment ahead (its number is its id) */
export function payOrderLink(orderNumber: number) {
  return { to: '/pay/order/$orderId', params: { orderId: String(orderNumber) } } as const
}
