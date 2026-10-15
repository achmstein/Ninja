// Loyalty types matching the Loyalty.API models

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyAccount {
  id: number
  userId: string
  userDisplayName?: string | null
  pointsBalance: number
  lifetimePoints: number
  currentTier: LoyaltyTier
  createdAt: string
  updatedAt: string
}

export interface LoyaltyStats {
  totalAccounts: number
  accountsByTier: Record<string, number>
  /** Points earned less points clawed back (a voided or refunded sale), today in the business's zone */
  pointsIssuedToday: number
  /** The same over the last 7 days (a rolling week, not a calendar one) */
  pointsIssuedThisWeek: number
  /** The same over the calendar month in the business's zone */
  pointsIssuedThisMonth: number
  pointsRedeemedToday?: number
  pointsRedeemedThisWeek?: number
  pointsRedeemedThisMonth?: number
  /** Points members hold now and may still redeem: the programme's liability */
  pointsOutstanding?: number
  todayStartsAt?: string | null
  weekStartsAt?: string | null
  monthStartsAt?: string | null
}

export interface TierInfo {
  name: string
  pointsRequired: number
  benefits: string
}

export interface PointsTransaction {
  id: number
  loyaltyAccountId: number
  points: number
  type: string
  referenceId?: string
  description: string
  createdAt: string
}

export interface EarnPointsRequest {
  userId: string
  points: number
  type: string
  description: string
  referenceId?: string
}

export interface AdjustPointsRequest {
  userId: string
  points: number // Positive or negative
  reason: string
}

// Tier colors for UI
// Visible on both light and dark surfaces; platinum reads as icy metallic
// rather than the near-invisible pale grey of literal platinum.
export const tierColors: Record<LoyaltyTier, string> = {
  bronze: '#B45309',
  silver: '#94A3B8',
  gold: '#EAB308',
  platinum: '#22D3EE',
}
