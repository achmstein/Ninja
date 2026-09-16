import { apiClient } from '@/lib/api-client'

// Notification.API does not emit an OpenAPI document yet, so this thin
// handwritten client mirrors its service-request endpoints.

export const REQUEST_CALL_WAITER = 1
export const REQUEST_CONTROLLER_CHANGE = 2
export const REQUEST_RECEIPT_TO_PAY = 3
export const REQUEST_SWITCH_TO_MULTI = 4
export const REQUEST_SWITCH_TO_SINGLE = 5

export const REQUEST_STATUS_PENDING = 1

export interface ServiceRequest {
  id: number
  userName: string
  placeId?: number | null
  placeKind?: string | null
  placeName?: { en?: string | null; ar?: string | null } | null
  optionCode?: string | null
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
