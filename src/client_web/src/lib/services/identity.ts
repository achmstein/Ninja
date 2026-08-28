import { apiClient } from '../api-client'

// Handwritten client for Identity.API (no OpenAPI document is emitted for
// it). Mirrors client_app/lib/features/settings/services/settings_service.dart.

const BASE = '/api/identity'

export type MyProfile = {
  name?: string | null
  email?: string | null
  phoneNumber?: string | null
}

// Egyptian mobile number, same rule as the mobile app
export const PHONE_PATTERN = /^01[0-9]{9}$/

export async function getMyProfile(): Promise<MyProfile> {
  const response = await apiClient.get<MyProfile>(`${BASE}/my-profile`)
  return response.data
}

export async function updateProfile(
  name: string,
  phoneNumber: string
): Promise<void> {
  await apiClient.post(`${BASE}/update-profile`, { name, phoneNumber })
}

export async function changePassword(newPassword: string): Promise<void> {
  await apiClient.post(`${BASE}/change-password`, { newPassword })
}

export async function deleteAccount(): Promise<void> {
  await apiClient.delete(`${BASE}/delete-account`)
}
