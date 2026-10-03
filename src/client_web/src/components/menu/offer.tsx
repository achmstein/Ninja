import { motion, useReducedMotion } from 'motion/react'
import { Flame } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Whether the dish is on an offer that actually takes something off */
export function isOnOffer(item: CatalogItemDto): boolean {
  return !!item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
}

/** How much the offer takes off, as a whole percent: 0 when it is not on one */
export function offerPercent(item: CatalogItemDto): number {
  const price = Number(item.price ?? 0)
  if (!isOnOffer(item) || price <= 0) return 0
  return Math.round((1 - Number(item.offerPrice ?? 0) / price) * 100)
}

/**
 * The deal, said the same way in every menu style: "−20%" on a warm coral
 * to orange pill with a flame, a light catching it once as it comes into
 * view. On a photo it sits in the corner (`photo`), in a row beside the name.
 * The colour is the offer's own, not the business's, so a deal reads as one
 * on any brand.
 */
export function OfferBadge({
  item,
  photo = false,
  className,
}: {
  item: CatalogItemDto
  photo?: boolean
  className?: string
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const pct = offerPercent(item)
  if (pct <= 0) return null
  // Western digits, as the menu's prices are
  const label = `−${pct}%`
  return (
    <span
      aria-label={`${t('offer')} ${label}`}
      className={cn(
        'from-offer to-offer-to text-offer-foreground relative inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-full bg-gradient-to-r font-bold tabular-nums',
        photo
          ? 'px-2.5 py-1 text-caption shadow-[0_6px_16px_-6px_rgb(0_0_0/0.5)]'
          : 'px-2 py-0.5 text-micro',
        className
      )}
    >
      <Flame className={photo ? 'size-3.5' : 'size-3'} strokeWidth={2.5} />
      {label}
      {!reduce && (
        <motion.span
          aria-hidden
          className='absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent'
          initial={{ x: '-150%' }}
          whileInView={{ x: '250%' }}
          viewport={{ once: true, amount: 1 }}
          transition={{ duration: 0.9, delay: 0.3, ease: 'easeInOut' }}
        />
      )}
    </span>
  )
}

/**
 * The price under an offer: the new one in the offer's colour and weight,
 * the old one struck and small beside it, so the saving is seen before it
 * is read. Off an offer, the plain price. `tone` is how it sits: on the page
 * (`page`, the price a pill), or on a photo's shade (`photo`, white).
 */
export function OfferPrice({
  item,
  tone = 'page',
  className,
}: {
  item: CatalogItemDto
  tone?: 'page' | 'photo'
  className?: string
}) {
  const price = usePrice()
  const on = isOnOffer(item)
  if (!on) {
    return tone === 'page' ? (
      <span className={cn('bg-muted rounded-full px-2.5 py-1 text-caption font-bold tabular-nums', className)}>
        {price(item.price)}
      </span>
    ) : (
      <span className={cn('font-bold tabular-nums', className)}>{price(item.price)}</span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-2 tabular-nums', className)}>
      <span
        className={cn(
          'font-bold',
          tone === 'page'
            ? 'from-offer to-offer-to text-offer-foreground rounded-full bg-gradient-to-r px-2.5 py-1 text-caption'
            : 'text-offer-to'
        )}
      >
        {price(item.offerPrice)}
      </span>
      <span className={cn('text-caption font-medium line-through', tone === 'page' ? 'text-muted-foreground' : 'opacity-70')}>
        {price(item.price)}
      </span>
    </span>
  )
}
