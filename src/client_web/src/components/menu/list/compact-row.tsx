import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { OfferBadge } from '../offer'
import { RowAction, SoldOutTag } from './dish-parts'
import { DISH_NOTE, rise, useDish, type DishProps } from './use-dish'

/** Compact: the name, a line of what it is, the price, the button; no photo, many to a screen */
export const CompactRow = memo(function CompactRow({ scroller, item, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const price = usePrice()
  // What the dish flies to the tray from: the round button, a small circle, not the wide row. Without
  // a photo on screen, its options have nothing to grow out of and rise in on their own
  const photo = useRef<HTMLSpanElement>(null)
  const dish = useDish({ item, onOpen, onQuickAdd, photo, grows: false })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex items-center gap-3 py-3', dish.soldOut && 'opacity-75')}>
      <button
        type='button'
        {...dish.handlers}
        className={cn('flex min-w-0 flex-1 flex-col text-start transition-transform duration-200 select-none [-webkit-touch-callout:none]', dish.pressing && 'scale-[0.98]')}
      >
        <span className='flex items-baseline justify-between gap-3'>
          <span className='flex min-w-0 items-center gap-2'>
            <span className='text-body leading-snug font-semibold'>{localized(item.name)}</span>
            {dish.onOffer && <OfferBadge item={item} />}
          </span>
          <span className='shrink-0 text-body font-bold tabular-nums'>
            {dish.onOffer && <span className='text-muted-foreground me-1.5 text-caption font-medium line-through'>{price(item.price)}</span>}
            <span className={cn(dish.onOffer && 'text-offer')}>{price(dish.onOffer ? item.offerPrice : item.price)}</span>
          </span>
        </span>
        {item.description && <span className={cn('text-muted-foreground line-clamp-1', DISH_NOTE)}>{localized(item.description)}</span>}
      </button>
      {dish.soldOut ? (
        <SoldOutTag />
      ) : (
        <span ref={photo} className='shrink-0 rounded-full'>
          <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={dish.open} />
        </span>
      )}
    </motion.div>
  )
})
