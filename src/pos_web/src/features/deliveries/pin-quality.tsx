import { CircleAlert, MapPin, MapPinCheck } from 'lucide-react'
import type { PinSource } from '@/features/sale/cart'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** How far a pin can be trusted, from where it came */
export type PinQuality = 'exact' | 'approximate' | 'none'

export function pinQuality(source: string | null | undefined, pinned: boolean): PinQuality {
  if (!pinned || !source || source === 'None') return pinned ? 'approximate' : 'none'
  return source === 'Search' ? 'approximate' : 'exact'
}

const WORDS: Record<Exclude<PinSource, 'None'> | 'None', TranslationKey> = {
  Customer: 'pinFromCustomer',
  Shared: 'pinFromCustomer',
  Rider: 'pinFromRider',
  Search: 'pinApproximate',
  None: 'pinNone',
}

/**
 * Whether the rider can go by the pin: the customer's own location (from
 * the app or the link), where a rider found the door before, near it only
 * (a street found on the map), or none, when the rider should call first.
 * Said in words and colour, never colour alone.
 */
export function PinQualityLabel({
  source,
  pinned,
  className,
}: {
  source: string | null | undefined
  pinned: boolean
  className?: string
}) {
  const t = useT()
  const quality = pinQuality(source, pinned)
  const key = !pinned ? 'None' : ((source && source in WORDS ? source : 'Search') as keyof typeof WORDS)
  const Icon = quality === 'exact' ? MapPinCheck : quality === 'approximate' ? MapPin : CircleAlert
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        quality === 'exact' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        quality === 'approximate' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        quality === 'none' && 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      <Icon className='size-3.5 shrink-0' aria-hidden />
      {t(WORDS[key])}
    </span>
  )
}
