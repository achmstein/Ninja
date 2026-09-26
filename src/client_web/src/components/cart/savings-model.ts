import { useEffect, useState } from 'react'
import { type TranslationKey } from '@/lib/i18n'

/** Points are redeemed in steps of this many */
export const POINTS_STEP = 50

/** Waits for a value to sit still, so a slider being dragged does not ask the server at every step */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

const PROMO_REASON: Record<string, TranslationKey> = {
  NotFound: 'promoNotFound',
  UsedUp: 'promoUsedUp',
  AlreadyUsed: 'promoAlreadyUsed',
  BelowMinimum: 'promoBelowMinimum',
}

/** Why a code does not apply, in words; anything unknown reads as "not valid now" */
export const promoReasonKey = (reason: string): TranslationKey => PROMO_REASON[reason] ?? 'promoNotValidNow'
