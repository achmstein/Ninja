import { useQuery } from '@tanstack/react-query'
import { getTierInfoOptions } from '@/api/loyalty/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import type { TranslationKey } from '@/lib/i18n'

export const TIER_KEYS: Record<string, TranslationKey> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  platinum: 'tierPlatinum',
}

/**
 * Where a member stands against the tiers: the next tier, if any, and how
 * far along the way to it they are (0 to 1; 1 at the top tier).
 */
export function useTierProgress(lifetime: number, enabled: boolean) {
  const { data: tiers = [] } = useQuery({
    ...getTierInfoOptions({ query: { 'api-version': API_VERSION } }),
    enabled,
  })
  const nextTier = [...tiers]
    .sort((a, b) => Number(a.pointsRequired) - Number(b.pointsRequired))
    .find((tier) => Number(tier.pointsRequired) > lifetime)
  const progress = nextTier ? Math.min(1, lifetime / Number(nextTier.pointsRequired)) : 1
  return { nextTier, progress }
}
