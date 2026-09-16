import { isAxiosError } from 'axios'
import type { LocalizedText } from '@/api/catalog'
import { apiClient } from '../api-client'

// Handwritten client for Notification.API (no OpenAPI document is emitted
// for it). Payload shapes mirror the mobile app's services in
// client_app/lib/features/{notifications,settings,service_request}.

const BASE = '/api/notifications'

// --- Push subscriptions -----------------------------------------------------

export type SubscriptionKind =
  'user-orders' | 'user-sessions' | 'room-availability'

export type SubscriptionStatus = {
  id?: number
  isSubscribed: boolean
  createdAt?: string
}

// 201 = subscribed, 409 = already subscribed (both count as success)
export async function subscribe(
  kind: SubscriptionKind,
  fcmToken: string,
  preferredLanguage: string,
  branchId?: number,
): Promise<boolean> {
  try {
    await apiClient.post(`${BASE}/subscriptions/${kind}`, {
      fcmToken,
      preferredLanguage,
      ...(branchId != null ? { branchId } : {}),
    })
    return true
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 409) return true
    return false
  }
}

export async function unsubscribe(kind: SubscriptionKind): Promise<boolean> {
  try {
    await apiClient.delete(`${BASE}/subscriptions/${kind}`)
    return true
  } catch {
    return false
  }
}

export async function getRoomAvailabilitySubscription(): Promise<SubscriptionStatus> {
  try {
    const response = await apiClient.get<SubscriptionStatus>(
      `${BASE}/subscriptions/room-availability`,
    )
    return response.data
  } catch {
    return { isSubscribed: false }
  }
}

// --- Notification preferences ----------------------------------------------

export type NotificationPreferences = {
  orderStatusUpdates: boolean
  promotionsAndOffers: boolean
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient.get<NotificationPreferences>(
    `${BASE}/preferences`,
  )
  return {
    orderStatusUpdates: response.data.orderStatusUpdates ?? true,
    promotionsAndOffers: response.data.promotionsAndOffers ?? true,
  }
}

export async function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<void> {
  await apiClient.put(`${BASE}/preferences`, preferences)
}

// --- Service requests -------------------------------------------------------

export const SERVICE_REQUEST = {
  callWaiter: 1,
  controllerChange: 2,
  receiptToPay: 3,
  switchToMulti: 4,
  switchToSingle: 5,
  /** Switch the stay to another rate option; the option travels in optionCode */
  changeOption: 6,
} as const

export type ServiceRequestType =
  (typeof SERVICE_REQUEST)[keyof typeof SERVICE_REQUEST]

/** From a place: the customer's running stay, or a table they scanned. The
 *  server allows the request by what the place can do. A guest at a table is
 *  known by the guest id header the api client already sends. */
export async function createServiceRequest(request: {
  requestType: ServiceRequestType
  placeId: number
  /** "Room", "Table" or "Station" */
  placeKind: string
  placeName: LocalizedText
  /** The running stay, when the request comes from one */
  sessionId?: number | null
  /** The rate option wanted, for a changeOption request */
  optionCode?: string
}): Promise<void> {
  await apiClient.post(`${BASE}/service-requests`, request)
}
