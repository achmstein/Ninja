import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DishPhotoBox, DishPrice, RowAction } from './dish-parts'
import { DISH_NAME, rise, useDish, type DishProps } from './use-dish'

/** Photo grid: two big photo tiles a row, the name and price under each, the button on the photo's corner */
export const PhotoTile = memo(function PhotoTile({ scroller, item, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const dish = useDish({ item, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex min-w-0 flex-col gap-2', dish.soldOut && 'opacity-75')}>
      <div className='relative'>
        <button type='button' {...dish.handlers} className='block w-full select-none [-webkit-touch-callout:none]'>
          <DishPhotoBox item={item} dish={dish} photoRef={photo} radius={24} className='aspect-[4/5] w-full' />
        </button>
        {!dish.soldOut && (
          <span className='absolute end-2 bottom-2'>
            <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={dish.open} />
          </span>
        )}
      </div>
      <button type='button' onClick={dish.open} className='flex flex-col items-start gap-1.5 px-1 text-start'>
        <span className={cn('line-clamp-2', DISH_NAME)}>{localized(item.name)}</span>
        <DishPrice item={item} onOffer={dish.onOffer} />
      </button>
    </motion.div>
  )
})
