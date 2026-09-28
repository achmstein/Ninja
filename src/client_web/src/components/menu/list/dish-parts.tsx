import type { ReactNode, RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, Minus, Plus, UtensilsCrossed } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { blurSwap } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { Odometer } from '@/components/ninja/odometer'
import { TONE_CLASS } from '../deck/deck-model'
import type { useDish } from './use-dish'

/** The photo box of a list's dish: the photo, or the plate on the café's colour, morphing into the options when opened */
export function DishPhotoBox({
  item,
  dish,
  photoRef,
  radius,
  className,
  children,
}: {
  item: CatalogItemDto
  dish: ReturnType<typeof useDish>
  photoRef: RefObject<HTMLDivElement | null>
  radius: number
  className?: string
  children?: ReactNode
}) {
  return (
    <motion.div
      ref={photoRef}
      layoutId={dish.morph ? `card-${item.id}` : undefined}
      style={{ borderRadius: radius }}
      className={cn(
        'relative shrink-0 overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none',
        !dish.hasPhoto && TONE_CLASS.primary,
        dish.soldOut && 'grayscale',
        dish.pressing && 'scale-[0.96]',
        className
      )}
    >
      {dish.hasPhoto ? (
        <motion.div layoutId={dish.morph ? `photo-${item.id}` : undefined} className='bg-muted absolute inset-0'>
          <img src={itemPictureUrl(item.id)} alt='' loading='lazy' decoding='async' draggable={false} onError={dish.fail} className='size-full object-cover' />
        </motion.div>
      ) : (
        <motion.div layoutId={dish.morph ? `photo-${item.id}` : undefined} className='absolute inset-0 grid place-items-center'>
          <UtensilsCrossed className='size-1/3 max-w-12 opacity-40' />
        </motion.div>
      )}
      {children}
    </motion.div>
  )
}

/** The price, and the struck-out one under an offer */
export function DishPrice({ item, onOffer, className }: { item: CatalogItemDto; onOffer: boolean; className?: string }) {
  const price = usePrice()
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className='bg-muted rounded-full px-2.5 py-1 text-caption font-bold tabular-nums'>{price(onOffer ? item.offerPrice : item.price)}</span>
      {onOffer && <span className='text-muted-foreground text-caption font-medium tabular-nums line-through'>{price(item.price)}</span>}
    </span>
  )
}

/**
 * The end of a classic row. A dish that needs no choosing: a round plus,
 * which once the dish is in the tray opens into less, how many and more,
 * as the classic menu always had it (more flies another in; less takes the
 * newest one back out). A dish with something to choose: a chevron to its
 * options.
 */
export function RowAction({
  item,
  quick,
  onAdd,
  onOpen,
  small = false,
}: {
  item: CatalogItemDto
  quick: boolean
  onAdd: () => void
  onOpen: () => void
  /** Drawn a size down (a classic row's), its reach kept a finger's: 44 px round it */
  small?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const swap = blurSwap(useReducedMotion())
  const lines = useCart((s) => s.lines).filter((l) => l.productId === Number(item.id))
  const setQuantity = useCart((s) => s.setQuantity)
  const count = lines.reduce((sum, l) => sum + l.quantity, 0)
  const fill = 'bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_rgb(0_0_0/0.45)]'
  const round = small ? "relative size-10 before:absolute before:-inset-0.5 before:content-['']" : 'size-11'

  if (!quick) {
    return (
      <button
        type='button'
        aria-label={localized(item.name)}
        onClick={onOpen}
        className={cn('grid shrink-0 place-items-center rounded-full transition-transform active:scale-90 motion-reduce:transform-none', round, fill)}
      >
        <ChevronRight className='size-5 rtl:rotate-180' strokeWidth={2.5} />
      </button>
    )
  }

  const less = () => {
    const newest = lines.at(-1)
    if (newest) setQuantity(lineKey(newest), newest.quantity - 1)
  }
  return (
    <AnimatePresence mode='popLayout' initial={false}>
      {count === 0 ? (
        <motion.button
          key='add'
          type='button'
          aria-label={t('addToCart')}
          onClick={onAdd}
          {...swap}
          className={cn('grid shrink-0 place-items-center rounded-full active:scale-90 motion-reduce:transform-none', round, fill)}
        >
          <Plus className='size-5' strokeWidth={2.5} />
        </motion.button>
      ) : (
        <motion.div key='step' {...swap} className={cn('flex shrink-0 items-center gap-0.5 rounded-full', small ? 'h-10 px-0.5' : 'h-11 px-1', fill)}>
          <button type='button' aria-label={t('ninjaLess')} onClick={less} className='grid size-9 place-items-center rounded-full active:bg-primary-foreground/15'>
            <Minus className='size-4' strokeWidth={2.5} />
          </button>
          <Odometer value={String(count)} className='min-w-5 text-center text-note font-bold' />
          <button type='button' aria-label={t('ninjaMore')} onClick={onAdd} className='grid size-9 place-items-center rounded-full active:bg-primary-foreground/15'>
            <Plus className='size-4' strokeWidth={2.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

