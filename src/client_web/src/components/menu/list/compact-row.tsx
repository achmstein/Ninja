import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PressRing } from '../deck/deck'
import { OfferBadge } from '../offer'
import { RowAction, SoldOutTag } from './item-parts'
import { ITEM_NOTE, rise, useItem, type ItemProps } from './use-item'

/** Compact: the name, a line of what it is, the price, the button; no photo, many to a screen */
export const CompactRow = memo(function CompactRow({ scroller, item, onOpen, onQuickAdd }: ItemProps) {
  const localized = useLocalized()
  const price = usePrice()
  // What the item flies to the tray from: the round button, a small circle, not the wide row. Without
  // a photo on screen, its options have nothing to grow out of and rise in on their own
  const photo = useRef<HTMLSpanElement>(null)
  const itemState = useItem({ item, onOpen, onQuickAdd, photo, grows: false })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex items-center gap-3 py-3', itemState.soldOut && 'opacity-75')}>
      <button
        type='button'
        {...itemState.handlers}
        className={cn('flex min-w-0 flex-1 flex-col text-start transition-transform duration-200 select-none [-webkit-touch-callout:none]', itemState.pressing && 'scale-[0.98]')}
      >
        <span className='flex items-baseline justify-between gap-3'>
          <span className='flex min-w-0 items-center gap-2'>
            <span className='text-body leading-snug font-semibold'>{localized(item.name)}</span>
            {itemState.onOffer && <OfferBadge item={item} />}
          </span>
          <span className='shrink-0 text-body font-bold tabular-nums'>
            {itemState.onOffer && <span className='text-muted-foreground me-1.5 text-caption font-medium line-through'>{price(item.price)}</span>}
            <span className={cn(itemState.onOffer && 'text-offer')}>{price(itemState.onOffer ? item.offerPrice : item.price)}</span>
          </span>
        </span>
        {item.description && <span className={cn('text-muted-foreground line-clamp-1', ITEM_NOTE)}>{localized(item.description)}</span>}
      </button>
      {itemState.soldOut ? (
        <SoldOutTag />
      ) : (
        <span ref={photo} className='relative shrink-0 rounded-full'>
          <RowAction item={item} quick={itemState.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={itemState.open} />
          {/* No photo to fill a ring on: held, the deck's ring covers the button */}
          <span
            aria-hidden
            className={cn('pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-150', itemState.pressing ? 'opacity-100' : 'opacity-0')}
          >
            <PressRing pressing={itemState.pressing} blur={itemState.pressing} />
          </span>
        </span>
      )}
    </motion.div>
  )
})
