import { apiClient } from '@/lib/api-client'
import type {
  LoyaltyAccount,
  LoyaltyStats,
  TierInfo,
  PointsTransaction,
  EarnPointsRequest,
  AdjustPointsRequest,
} from '../types'

// The API reports enum names ("Bronze", "Purchase"); the UI works in
// lowercase throughout, so normalize at the edge.
function normalizeAccount(account: LoyaltyAccount): LoyaltyAccount {
  return {
    ...account,
    currentTier: (account.currentTier?.toLowerCase() ??
      'bronze') as LoyaltyAccount['currentTier'],
  }
}

export const loyaltyService = {
  // Get paginated list of loyalty accounts
  async getAccounts(first = 0, max = 50): Promise<LoyaltyAccount[]> {
    const params = new URLSearchParams({
      first: String(first),
      max: String(max),
      'api-version': '1.0',
    })
    const response = await apiClient.get<LoyaltyAccount[]>(`/api/loyalty/accounts?${params}`)
    return response.data.map(normalizeAccount)
  },

  // Get a single loyalty account by user ID
  async getAccount(userId: string): Promise<LoyaltyAccount> {
    const response = await apiClient.get<LoyaltyAccount>(
      `/api/loyalty/accounts/${userId}?api-version=1.0`
    )
    return normalizeAccount(response.data)
  },

  // Get loyalty program statistics
  async getStats(): Promise<LoyaltyStats> {
    const response = await apiClient.get<LoyaltyStats>('/api/loyalty/stats?api-version=1.0')
    return {
      ...response.data,
      accountsByTier: Object.fromEntries(
        Object.entries(response.data.accountsByTier ?? {}).map(
          ([tier, count]) => [tier.toLowerCase(), count]
        )
      ),
    }
  },

  // Get tier information
  async getTiers(): Promise<TierInfo[]> {
    const response = await apiClient.get<TierInfo[]>('/api/loyalty/tiers?api-version=1.0')
    return response.data
  },

  // Get transaction history for a user
  async getTransactions(userId: string, max = 50): Promise<PointsTransaction[]> {
    const params = new URLSearchParams({
      max: String(max),
      'api-version': '1.0',
    })
    const response = await apiClient.get<PointsTransaction[]>(
      `/api/loyalty/transactions/${userId}?${params}`
    )
    return response.data.map((transaction) => ({
      ...transaction,
      type: transaction.type?.toLowerCase() ?? '',
    }))
  },

  // Earn points for a user
  async earnPoints(data: EarnPointsRequest): Promise<void> {
    await apiClient.post('/api/loyalty/transactions/earn?api-version=1.0', data)
  },

  // Adjust points for a user (admin only)
  async adjustPoints(data: AdjustPointsRequest): Promise<void> {
    await apiClient.post('/api/loyalty/transactions/adjust?api-version=1.0', data)
  },

  // Create a new loyalty account
  async createAccount(userId: string): Promise<LoyaltyAccount> {
    const response = await apiClient.post<LoyaltyAccount>(
      '/api/loyalty/accounts?api-version=1.0',
      { userId }
    )
    return response.data
  },
}
