import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SHORT } from '@/components/ninja/shell/chrome'
import { DishPhotoBox, DishPrice, RowAction, SoldOutTag } from './dish-parts'
import { DISH_NAME, DISH_NOTE, rise, useDish, type DishProps } from './use-dish'

/**
 * The classic menu's dish: the deck's card laid on its side. Its photo, its
 * name in the heading's voice and a line of what it is, the price its pill,
 * and a round button at the end. The row's photo stays put while a dish
 * flies to the tray: the flight leaves from the options sheet as often as
 * from here, and a row is small enough that a copy lifting off reads fine.
 */
export const Row = memo(function Row({ scroller, item, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const dish = useDish({ item, onOpen, onQuickAdd, photo })

  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex items-center gap-3', dish.soldOut && 'opacity-75')}>
      <button type='button' {...dish.handlers} className='flex min-w-0 flex-1 items-center gap-3 text-start select-none [-webkit-touch-callout:none]'>
        {/* Sized to leave the name and its line the room to read on a small phone, and a few dishes to a screen */}
        <DishPhotoBox item={item} dish={dish} photoRef={photo} radius={20} offerSmall className={SHORT ? 'size-18' : 'size-20'} />
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className={DISH_NAME}>{localized(item.name)}</span>
          {item.description && <span className={cn('text-muted-foreground line-clamp-2', DISH_NOTE)}>{localized(item.description)}</span>}
          <DishPrice item={item} onOffer={dish.onOffer} className='mt-1.5' />
        </span>
      </button>
      {dish.soldOut ? (
        <SoldOutTag />
      ) : (
        <RowAction small item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={dish.open} />
      )}
    </motion.div>
  )
})
