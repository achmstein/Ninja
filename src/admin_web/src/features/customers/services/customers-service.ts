import { apiClient } from '@/lib/api-client'
import type { Customer, CustomerParams } from '../types'

export type StaffRole = 'Admin' | 'Cashier' | 'Kitchen' | 'Rider'

export const customersService = {
  // Get paginated list of customers. `role` / `excludeRole` take one role or
  // a comma-separated list.
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

  // Create a staff account: an Admin (optionally Owner) or a Cashier, with
  // the branches it may work in (Owner)
  async registerAdmin(request: {
    name?: string
    email: string
    password: string
    role?: StaffRole
    isOwner?: boolean
    branchIds?: number[]
    /** Every branch, those opened later too: a call centre's account */
    allBranches?: boolean
  }): Promise<string | null> {
    // The new login's id, so the register can link it to an employee
    const { data } = await apiClient.post<{ userId?: string }>(
      '/api/identity/register-admin',
      request
    )
    return data?.userId ?? null
  },

  // A staff account's name (Admin): the services that show it hear of the change
  async updateName(userId: string, name: string): Promise<void> {
    await apiClient.put(`/api/identity/users/${userId}/profile`, { name })
  },

  // Replace the branches a staff account may work in (Owner). The change
  // reaches the user's token on its next refresh. allBranches gives every
  // branch, those opened later too (a call centre's account).
  async setBranches(
    userId: string,
    branchIds: number[],
    allBranches = false
  ): Promise<void> {
    await apiClient.put(`/api/identity/users/${userId}/branches`, {
      branchIds,
      allBranches,
    })
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
