import {
  adjustPoints,
  createAccount,
  earnPoints,
  getAccount,
  getStats,
  getTierInfo,
  getTransactions,
  listAccounts,
} from '@ninja/api/loyalty/sdk.gen'
import type {
  AdjustPointsRequest,
  EarnPointsRequest,
  LoyaltyAccount,
  LoyaltyStats,
  PointsTransaction,
  TierInfo,
} from '../types'

// The generated client types decimals loosely (number | string) where these
// screens' own types say number; the API sends numbers, so they are read as
// the screens' types here, at the edge.

// The API reports enum names ("Bronze", "Purchase"); the UI works in
// lowercase throughout, so normalize at the edge.
function normalizeAccount(account: LoyaltyAccount): LoyaltyAccount {
  return {
    ...account,
    currentTier: (account.currentTier?.toLowerCase() ?? 'bronze') as LoyaltyAccount['currentTier'],
  }
}

/** The back office's loyalty calls, on the generated Loyalty client */
export const loyaltyService = {
  // Paginated list of loyalty accounts
  async getAccounts(first = 0, max = 50): Promise<LoyaltyAccount[]> {
    const { data } = await listAccounts({ query: { first, max }, throwOnError: true })
    return (data as unknown as LoyaltyAccount[]).map(normalizeAccount)
  },

  // A single loyalty account by user ID
  async getAccount(userId: string): Promise<LoyaltyAccount> {
    const { data } = await getAccount({ path: { userId }, throwOnError: true })
    return normalizeAccount(data as unknown as LoyaltyAccount)
  },

  // Loyalty program statistics
  async getStats(): Promise<LoyaltyStats> {
    const { data } = await getStats({ throwOnError: true })
    const stats = data as unknown as LoyaltyStats
    return {
      ...stats,
      accountsByTier: Object.fromEntries(
        Object.entries(stats.accountsByTier ?? {}).map(([tier, count]) => [tier.toLowerCase(), count])
      ),
    }
  },

  // Tier information
  async getTiers(): Promise<TierInfo[]> {
    const { data } = await getTierInfo({ throwOnError: true })
    return data as unknown as TierInfo[]
  },

  // Transaction history for a user
  async getTransactions(userId: string, max = 50): Promise<PointsTransaction[]> {
    const { data } = await getTransactions({ path: { userId }, query: { max }, throwOnError: true })
    return (data as unknown as PointsTransaction[]).map((transaction) => ({
      ...transaction,
      type: transaction.type?.toLowerCase() ?? '',
    }))
  },

  // Earn points for a user
  async earnPoints(body: EarnPointsRequest): Promise<void> {
    await earnPoints({ body, throwOnError: true })
  },

  // Adjust points for a user (admin only)
  async adjustPoints(body: AdjustPointsRequest): Promise<void> {
    await adjustPoints({ body, throwOnError: true })
  },

  // Create a new loyalty account
  async createAccount(userId: string): Promise<LoyaltyAccount> {
    const { data } = await createAccount({ body: { userId }, throwOnError: true })
    return data as unknown as LoyaltyAccount
  },
}
