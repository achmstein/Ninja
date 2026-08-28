import { apiClient } from '@/lib/api-client'

// Notification.API does not emit an OpenAPI document yet, so this thin
// handwritten client mirrors its announcement endpoints.
export interface Announcement {
  id: number
  title: string
  body: string
  sentBy: string
  sentAt: string
  recipientCount: number
}

export const announcementsService = {
  async list(limit = 50): Promise<Announcement[]> {
    const response = await apiClient.get<Announcement[]>(
      '/api/notifications/announcements',
      { params: { limit } }
    )
    return response.data
  },

  async send(title: string, body: string): Promise<Announcement> {
    const response = await apiClient.post<Announcement>(
      '/api/notifications/announcements',
      { title, body }
    )
    return response.data
  },
}
