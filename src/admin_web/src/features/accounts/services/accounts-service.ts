import {
  addCharge,
  getAccountByCustomerId,
  getAllAccounts,
  recordPayment,
  searchAccounts,
} from '@ninja/api/accounts/sdk.gen'
import { apiClient } from '@/lib/api-client'
import type { AccountSummary, AddChargeRequest, CustomerAccount, KeycloakUser, RecordPaymentRequest } from '../types'

// The generated client types decimals loosely (number | string) where these
// screens' own types say number; the API sends numbers, so they are read as
// the screens' types here, at the edge.

/** The back office's customer-account calls, on the generated Accounts client */
export const accountsService = {
  // All accounts
  async getAccounts(): Promise<AccountSummary[]> {
    const { data } = await getAllAccounts({ throwOnError: true })
    return data as unknown as AccountSummary[]
  },

  // Search accounts
  async searchAccounts(searchTerm?: string): Promise<AccountSummary[]> {
    const { data } = await searchAccounts({ query: searchTerm ? { q: searchTerm } : undefined, throwOnError: true })
    return data as unknown as AccountSummary[]
  },

  // The account of a customer, or null when there is none (or it could not be read)
  async getAccount(customerId: string): Promise<CustomerAccount | null> {
    try {
      const { data } = await getAccountByCustomerId({ path: { customerId }, throwOnError: true })
      return data as unknown as CustomerAccount
    } catch {
      return null
    }
  },

  // Add a charge to a customer's account
  async addCharge(customerId: string, body: AddChargeRequest): Promise<void> {
    await addCharge({ path: { customerId }, body, throwOnError: true })
  },

  // Record a payment on a customer's account
  async recordPayment(customerId: string, body: RecordPaymentRequest): Promise<void> {
    await recordPayment({ path: { customerId }, body, throwOnError: true })
  },

  // The users in Keycloak, for the customer search (Identity has no generated client yet)
  async getUsers(search?: string): Promise<KeycloakUser[]> {
    const params = search ? { search } : {}
    const response = await apiClient.get<KeycloakUser[]>('/api/identity/users', { params })
    return response.data
  },
}
