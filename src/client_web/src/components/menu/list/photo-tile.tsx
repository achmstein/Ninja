import { useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DishPhotoBox, DishPrice, RowAction } from './dish-parts'
import { rise, useDish, type DishProps } from './use-dish'

/** Photo grid: two big photo tiles a row, the name and price under each, the button on the photo's corner */
export function PhotoTile({ scroller, item, opening, landing, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const dish = useDish({ item, opening, landing, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex min-w-0 flex-col gap-2', dish.soldOut && 'opacity-50')}>
      <div className='relative'>
        <button type='button' {...dish.handlers} className='block w-full select-none [-webkit-touch-callout:none]'>
          <DishPhotoBox item={item} dish={dish} photoRef={photo} radius={24} className='aspect-[4/5] w-full' />
        </button>
        {!dish.soldOut && (
          <span className='absolute end-2 bottom-2'>
            <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={() => onOpen(item)} />
          </span>
        )}
      </div>
      <button type='button' onClick={() => onOpen(item)} className='flex flex-col items-start gap-1.5 px-1 text-start'>
        <span className='heading line-clamp-2 text-[calc(1rem*var(--heading-scale))] leading-tight'>{localized(item.name)}</span>
        <DishPrice item={item} onOffer={dish.onOffer} />
      </button>
    </motion.div>
  )
}
