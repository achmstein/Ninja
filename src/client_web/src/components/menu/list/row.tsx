import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SHORT } from '@/components/ninja/shell/chrome'
import { ItemPhotoBox, ItemPrice, RowAction, SoldOutTag } from './item-parts'
import { ITEM_NAME, ITEM_NOTE, rise, useItem, type ItemProps } from './use-item'

/**
 * The classic menu's item: the deck's card laid on its side. Its photo, its
 * name in the heading's voice and a line of what it is, the price its pill,
 * and a round button at the end. The row's photo stays put while an item
 * flies to the tray: the flight leaves from the options sheet as often as
 * from here, and a row is small enough that a copy lifting off reads fine.
 */
export const Row = memo(function Row({ scroller, item, onOpen, onQuickAdd }: ItemProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const itemState = useItem({ item, onOpen, onQuickAdd, photo })

  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex items-center gap-3', itemState.soldOut && 'opacity-75')}>
      <button type='button' {...itemState.handlers} className='flex min-w-0 flex-1 items-center gap-3 text-start select-none [-webkit-touch-callout:none]'>
        {/* Sized to leave the name and its line the room to read on a small phone, and a few items to a screen */}
        <ItemPhotoBox item={item} itemState={itemState} photoRef={photo} radius={20} offerSmall className={SHORT ? 'size-18' : 'size-20'} />
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className={ITEM_NAME}>{localized(item.name)}</span>
          {item.description && <span className={cn('text-muted-foreground line-clamp-2', ITEM_NOTE)}>{localized(item.description)}</span>}
          <ItemPrice item={item} onOffer={itemState.onOffer} className='mt-1.5' />
        </span>
      </button>
      {itemState.soldOut ? (
        <SoldOutTag />
      ) : (
        <RowAction small item={item} quick={itemState.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={itemState.open} />
      )}
    </motion.div>
  )
})
