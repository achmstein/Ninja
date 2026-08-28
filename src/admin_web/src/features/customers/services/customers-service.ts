import { apiClient } from '@/lib/api-client'
import type { Customer, CustomerParams } from '../types'

export const customersService = {
  // Get paginated list of customers
  async getCustomers(params: CustomerParams = {}): Promise<Customer[]> {
    const queryParams = new URLSearchParams()
    if (params.first !== undefined) {
      queryParams.append('first', String(params.first))
    }
    if (params.max !== undefined) {
      queryParams.append('max', String(params.max))
    }
    if (params.search) {
      queryParams.append('search', params.search)
    }
    if (params.role) {
      queryParams.append('role', params.role)
    }
    if (params.excludeRole) {
      queryParams.append('excludeRole', params.excludeRole)
    }

    const url = `/api/identity/users${queryParams.toString() ? `?${queryParams}` : ''}`
    const response = await apiClient.get<Customer[]>(url)
    return response.data
  },

  // Toggle a user's enabled state (Owner)
  async toggleEnabled(userId: string): Promise<void> {
    await apiClient.put(`/api/identity/users/${userId}/toggle-enabled`)
  },

  // Create a new admin or owner account (Owner)
  async registerAdmin(request: {
    name?: string
    email: string
    password: string
    isOwner?: boolean
  }): Promise<void> {
    await apiClient.post('/api/identity/register-admin', request)
  },

  // Get a single customer by ID
  async getCustomer(userId: string): Promise<Customer> {
    const response = await apiClient.get<Customer>(`/api/identity/users/${userId}`)
    return response.data
  },

  // Get total customer count
  async getCustomerCount(search?: string): Promise<number> {
    const queryParams = search ? `?search=${encodeURIComponent(search)}` : ''
    const response = await apiClient.get<{ count: number }>(
      `/api/identity/users/count${queryParams}`
    )
    return response.data.count
  },
}
