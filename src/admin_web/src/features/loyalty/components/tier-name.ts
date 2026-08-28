import { type TranslationKey } from '@/lib/i18n'
import { type LoyaltyTier } from '../types'

// Localized tier names come from the shared ARB keys.
export const tierNameKeys: Record<LoyaltyTier, TranslationKey> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  platinum: 'tierPlatinum',
}
