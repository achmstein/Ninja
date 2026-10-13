import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { OfferPrice } from '../offer'
import { ItemPhotoBox, RowAction } from './item-parts'
import { ITEM_NOTE, rise, useItem, type ItemProps } from './use-item'

/** Magazine: one wide photo an item, the name and price set on it under a shade, the button on its corner */
export const HeroCard = memo(function HeroCard({ scroller, item, onOpen, onQuickAdd }: ItemProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const itemState = useItem({ item, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('relative', itemState.soldOut && 'opacity-75')}>
      <button type='button' {...itemState.handlers} className='block w-full text-start select-none [-webkit-touch-callout:none]'>
        <ItemPhotoBox item={item} itemState={itemState} photoRef={photo} radius={28} className='aspect-[16/11] w-full'>
          <span className='absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pe-20 pt-16 text-white'>
            <span className='heading text-title leading-tight'>{localized(item.name)}</span>
            {item.description && <span className={cn('line-clamp-1 opacity-80', ITEM_NOTE)}>{localized(item.description)}</span>}
            <OfferPrice item={item} tone='photo' className='mt-1 text-body' />
          </span>
        </ItemPhotoBox>
      </button>
      {!itemState.soldOut && (
        <span className='absolute end-4 bottom-4'>
          <RowAction item={item} quick={itemState.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={itemState.open} />
        </span>
      )}
    </motion.div>
  )
})
