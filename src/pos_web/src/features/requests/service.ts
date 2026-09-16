import { apiClient } from '@/lib/api-client'

// Notification.API emits no OpenAPI document, so this thin handwritten client
// mirrors its service-request endpoints (same shape admin_web uses). The
// shared apiClient sends the bearer token, api-version and X-Branch-Id, so the
// branch's pending requests come back scoped to the till's current branch.

export const REQUEST_CALL_WAITER = 1
export const REQUEST_CONTROLLER_CHANGE = 2
export const REQUEST_RECEIPT_TO_PAY = 3
export const REQUEST_SWITCH_TO_MULTI = 4
export const REQUEST_SWITCH_TO_SINGLE = 5

export const REQUEST_STATUS_PENDING = 1
export const REQUEST_STATUS_ACKNOWLEDGED = 2
export const REQUEST_STATUS_COMPLETED = 3

export type ServiceRequest = {
  id: number
  userName: string
  roomId: number | null
  /** The place: the room, or the table's name for a table request */
  roomName: { en?: string | null; ar?: string | null }
  tableId?: number | null
  tableName?: { en?: string | null; ar?: string | null } | null
  requestType: number
  status: number
  createdAt: string
}

export const serviceRequestsService = {
  async pending(): Promise<ServiceRequest[]> {
    const response = await apiClient.get<ServiceRequest[]>(
      '/api/notifications/service-requests/pending'
    )
    return response.data
  },

  async acknowledge(id: number): Promise<ServiceRequest> {
    const response = await apiClient.put<ServiceRequest>(
      `/api/notifications/service-requests/${id}/acknowledge`
    )
    return response.data
  },

  async complete(id: number): Promise<ServiceRequest> {
    const response = await apiClient.put<ServiceRequest>(
      `/api/notifications/service-requests/${id}/complete`
    )
    return response.data
  },
}
