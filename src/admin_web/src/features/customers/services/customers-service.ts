import { API_VERSION, apiClient } from '@/lib/api-client'
import type { Customer, CustomerParams } from '../types'

export type StaffRole = 'Admin' | 'Cashier' | 'Kitchen' | 'Rider'

/** What one customer has ordered, across every branch (Ordering's count). */
export type CustomerOrderSummary = {
  customerId: string
  orderCount: number
  totalSpent: number
  firstOrderAt: string
  lastOrderAt: string
}

export const customersService = {
  // What each customer has ordered: the list's last order, orders and spent
  async getOrderSummaries(): Promise<CustomerOrderSummary[]> {
    const response = await apiClient.get<CustomerOrderSummary[]>('/api/orders/customers/summary', {
      params: { 'api-version': API_VERSION },
    })
    return response.data
  },

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
    if (params.enabled !== undefined) {
      queryParams.append('enabled', String(params.enabled))
    }

    const url = `/api/identity/users${queryParams.toString() ? `?${queryParams}` : ''}`
    const response = await apiClient.get<Customer[]>(url)
    return response.data
  },

  // Two accounts that are one person (Owner): everything kept under the
  // first goes to the second, and the first is switched off. Not undoable
  async mergeInto(fromId: string, intoId: string): Promise<void> {
    await apiClient.post(`/api/identity/users/${fromId}/merge-into/${intoId}`)
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
    const { data } = await apiClient.post<{ userId?: string }>('/api/identity/register-admin', request)
    return data?.userId ?? null
  },

  // A staff account's name (Admin): the services that show it hear of the change
  async updateName(userId: string, name: string): Promise<void> {
    await apiClient.put(`/api/identity/users/${userId}/profile`, { name })
  },

  // A staff account's name and phone (Admin); a null phone leaves it as it is
  async updateProfile(
    userId: string,
    profile: { firstName: string; lastName: string; phoneNumber: string | null }
  ): Promise<void> {
    await apiClient.put(`/api/identity/users/${userId}/profile`, profile)
  },

  // A new password for a staff account that forgot its own (Admin)
  async setPassword(userId: string, newPassword: string): Promise<void> {
    await apiClient.put(`/api/identity/users/${userId}/password`, {
      newPassword,
    })
  },

  // Replace the branches a staff account may work in (Owner). The change
  // reaches the user's token on its next refresh. allBranches gives every
  // branch, those opened later too (a call centre's account).
  async setBranches(userId: string, branchIds: number[], allBranches = false): Promise<void> {
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
  async getCustomerCount(params: Pick<CustomerParams, 'search' | 'excludeRole' | 'enabled'> = {}): Promise<number> {
    const queryParams = new URLSearchParams()
    if (params.search) queryParams.append('search', params.search)
    if (params.excludeRole) queryParams.append('excludeRole', params.excludeRole)
    if (params.enabled !== undefined) {
      queryParams.append('enabled', String(params.enabled))
    }
    const response = await apiClient.get<{ count: number }>(
      `/api/identity/users/count${queryParams.toString() ? `?${queryParams}` : ''}`
    )
    return response.data.count
  },
}
