import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ItemPhotoBox, ItemPrice, RowAction } from './item-parts'
import { ITEM_NAME, rise, useItem, type ItemProps } from './use-item'

/** Photo grid: two big photo tiles a row, the name and price under each, the button on the photo's corner */
export const PhotoTile = memo(function PhotoTile({ scroller, item, onOpen, onQuickAdd }: ItemProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const itemState = useItem({ item, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex min-w-0 flex-col gap-2', itemState.soldOut && 'opacity-75')}>
      <div className='relative'>
        <button type='button' {...itemState.handlers} className='block w-full select-none [-webkit-touch-callout:none]'>
          <ItemPhotoBox item={item} itemState={itemState} photoRef={photo} radius={24} className='aspect-[4/5] w-full' />
        </button>
        {!itemState.soldOut && (
          <span className='absolute end-2 bottom-2'>
            <RowAction item={item} quick={itemState.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={itemState.open} />
          </span>
        )}
      </div>
      <button type='button' onClick={itemState.open} className='flex flex-col items-start gap-1.5 px-1 text-start'>
        <span className={cn('line-clamp-2', ITEM_NAME)}>{localized(item.name)}</span>
        <ItemPrice item={item} onOffer={itemState.onOffer} />
      </button>
    </motion.div>
  )
})
