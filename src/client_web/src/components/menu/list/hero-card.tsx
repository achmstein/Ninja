import { memo, useRef } from 'react'
import { motion } from 'motion/react'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DishPhotoBox, RowAction } from './dish-parts'
import { DISH_NOTE, rise, useDish, type DishProps } from './use-dish'

/** Magazine: one wide photo a dish, the name and price set on it under a shade, the button on its corner */
export const HeroCard = memo(function HeroCard({ scroller, item, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const price = usePrice()
  const photo = useRef<HTMLDivElement>(null)
  const dish = useDish({ item, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('relative', dish.soldOut && 'opacity-50')}>
      <button type='button' {...dish.handlers} className='block w-full text-start select-none [-webkit-touch-callout:none]'>
        <DishPhotoBox item={item} dish={dish} photoRef={photo} radius={28} className='aspect-[16/11] w-full'>
          <span className='absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pe-20 pt-16 text-white'>
            <span className='heading text-title leading-tight'>{localized(item.name)}</span>
            {item.description && <span className={cn('line-clamp-1 opacity-80', DISH_NOTE)}>{localized(item.description)}</span>}
            <span className='mt-1 text-body font-bold tabular-nums'>
              {price(dish.onOffer ? item.offerPrice : item.price)}
              {dish.onOffer && <span className='ms-2 text-caption font-medium line-through opacity-70'>{price(item.price)}</span>}
            </span>
          </span>
        </DishPhotoBox>
      </button>
      {!dish.soldOut && (
        <span className='absolute end-4 bottom-4'>
          <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={dish.open} />
        </span>
      )}
    </motion.div>
  )
})
