import { apiClient } from '../api-client'

// Handwritten client for Identity.API (no OpenAPI document is emitted for
// it). Mirrors client_app/lib/features/settings/services/settings_service.dart.

const BASE = '/api/identity'

export type MyProfile = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phoneNumber?: string | null
}

/** First and last name to fill a form with: the profile's own, or a whole name split at its first space */
export function namePartsOf(profile: MyProfile | null | undefined, fallbackName?: string | null): [string, string] {
  if (profile?.firstName || profile?.lastName) return [profile.firstName?.trim() ?? '', profile.lastName?.trim() ?? '']
  const whole = (profile?.name || fallbackName || '').trim()
  const space = whole.indexOf(' ')
  return space < 0 ? [whole, ''] : [whole.slice(0, space), whole.slice(space + 1).trim()]
}

/**
 * Whether the profile holds both a first and a last name. An Apple account can
 * come without either (Apple gives the name on the first sign-in only, and the
 * browser's sign-in never passes it on), so it is asked for what it lacks.
 */
export function hasWholeName(profile: MyProfile | null | undefined): boolean {
  return !!profile?.firstName?.trim() && !!profile?.lastName?.trim()
}

export async function getMyProfile(): Promise<MyProfile> {
  const response = await apiClient.get<MyProfile>(`${BASE}/my-profile`)
  return response.data
}

export async function updateProfile(
  firstName: string,
  lastName: string,
  phoneNumber: string
): Promise<void> {
  await apiClient.post(`${BASE}/update-profile`, { firstName, lastName, phoneNumber })
}

export async function changePassword(newPassword: string): Promise<void> {
  await apiClient.post(`${BASE}/change-password`, { newPassword })
}

export async function deleteAccount(): Promise<void> {
  await apiClient.delete(`${BASE}/delete-account`)
}

// Claiming an account the café added at the counter (name and phone, no
// email): anonymous, with the one-time token from the link or QR the
// cashier showed.

export type ClaimPreview = {
  name: string
  phoneNumber?: string | null
  expiresAt?: string | null
}

export async function previewClaim(token: string): Promise<ClaimPreview> {
  const response = await apiClient.post<ClaimPreview>(`${BASE}/claim/preview`, { token })
  return response.data
}

export async function claimAccount(
  token: string,
  email: string,
  password: string
): Promise<{ email: string }> {
  const response = await apiClient.post<{ email: string }>(`${BASE}/claim`, {
    token,
    email,
    password,
  })
  return response.data
}
