import { useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { RowAction } from './dish-parts'
import { DISH_NOTE, rise, useDish, type DishProps } from './use-dish'

/** Compact: the name, a line of what it is, the price, the button; no photo, many to a screen */
export function CompactRow({ scroller, item, opening, landing, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const price = usePrice()
  // What the dish flies to the tray from: the round button, a small circle, not the wide row
  const photo = useRef<HTMLSpanElement>(null)
  const dish = useDish({ item, opening, landing, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex items-center gap-3 py-3', dish.soldOut && 'opacity-50')}>
      {/* The whole row is what grows into the options; mounted afresh as it takes its layout id (see DishPhotoBox) */}
      <motion.button
        key={dish.morph ? 'morph' : 'still'}
        type='button'
        layoutId={dish.morph ? `card-${item.id}` : undefined}
        style={{ borderRadius: 16 }}
        {...dish.handlers}
        className={cn('flex min-w-0 flex-1 flex-col text-start transition-transform duration-200 select-none [-webkit-touch-callout:none]', dish.pressing && 'scale-[0.98]')}
      >
        <span className='flex items-baseline justify-between gap-3'>
          <span className='text-body leading-snug font-semibold'>{localized(item.name)}</span>
          <span className='shrink-0 text-body font-bold tabular-nums'>
            {dish.onOffer && <span className='text-muted-foreground me-1.5 text-caption font-medium line-through'>{price(item.price)}</span>}
            {price(dish.onOffer ? item.offerPrice : item.price)}
          </span>
        </span>
        {item.description && <span className={cn('text-muted-foreground line-clamp-1', DISH_NOTE)}>{localized(item.description)}</span>}
      </motion.button>
      {!dish.soldOut && (
        <span ref={photo} className='shrink-0 rounded-full'>
          <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={() => onOpen(item)} />
        </span>
      )}
    </motion.div>
  )
}
