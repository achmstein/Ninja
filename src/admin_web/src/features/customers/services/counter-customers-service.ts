import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import type { Customer } from '../types'

/** What the lookup says about a name and a number as they are typed. */
export type CustomerLookup = {
  /** The number as the server will store it */
  phone: string
  phoneValid: boolean
  /** The one customer who already has this number */
  match: Customer | null
  /** A few customers whose names look like this one */
  similar: Customer[]
}

export type ClaimLink = { token: string; expiresAt: string }

/** The customer the number already belongs to, when creating said 409. */
export function existingCustomerOf(error: unknown): Customer | null {
  if (error instanceof AxiosError && error.response?.status === 409) {
    return (error.response.data as { existing?: Customer })?.existing ?? null
  }
  return null
}

/** The claim page on the café's customer host. */
export function claimUrl(customerOrigin: string, token: string): string {
  return `${customerOrigin}/claim?token=${encodeURIComponent(token)}`
}

/**
 * Customers added by name and phone (at the till or here), and the
 * one-time link that hands such an account to its customer.
 */
export const counterCustomersService = {
  async lookup(
    params: { phone?: string; name?: string },
    signal?: AbortSignal
  ): Promise<CustomerLookup> {
    const { data } = await apiClient.get<CustomerLookup>(
      '/api/identity/customers/lookup',
      { params, signal }
    )
    return data
  },

  async create(name: string, phoneNumber: string): Promise<Customer> {
    const { data } = await apiClient.post<Customer>('/api/identity/customers', {
      name,
      phoneNumber,
    })
    return data
  },

  async claimLink(userId: string): Promise<ClaimLink> {
    const { data } = await apiClient.post<ClaimLink>(
      `/api/identity/customers/${userId}/claim-link`
    )
    return data
  },
}
