import { apiClient } from '@/lib/api-client'
import type { CustomerAccount, AccountSummary, AddChargeRequest, RecordPaymentRequest, KeycloakUser } from '../types'

export const accountsService = {
  // Get all accounts
  async getAccounts(): Promise<AccountSummary[]> {
    const response = await apiClient.get<AccountSummary[]>('/api/accounts')
    return response.data
  },

  // Search accounts
  async searchAccounts(searchTerm?: string): Promise<AccountSummary[]> {
    const params = searchTerm ? { q: searchTerm } : {}
    const response = await apiClient.get<AccountSummary[]>('/api/accounts/search', { params })
    return response.data
  },

  // Get account by customer ID
  async getAccount(customerId: string): Promise<CustomerAccount | null> {
    try {
      const response = await apiClient.get<CustomerAccount>(`/api/accounts/${customerId}`)
      return response.data
    } catch {
      return null
    }
  },

  // Add charge to customer account
  async addCharge(customerId: string, request: AddChargeRequest): Promise<void> {
    await apiClient.post(`/api/accounts/${customerId}/charge`, request)
  },

  // Record payment for customer account
  async recordPayment(customerId: string, request: RecordPaymentRequest): Promise<void> {
    await apiClient.post(`/api/accounts/${customerId}/payment`, request)
  },

  // Get all users from Keycloak (for customer search)
  async getUsers(search?: string): Promise<KeycloakUser[]> {
    const params = search ? { search } : {}
    const response = await apiClient.get<KeycloakUser[]>('/api/identity/users', { params })
    return response.data
  },
}
