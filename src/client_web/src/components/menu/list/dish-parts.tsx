import type { ReactNode, RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, Minus, Plus, UtensilsCrossed } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, useT } from '@/lib/i18n'
import { blurSwap } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { Odometer } from '@/components/ninja/odometer'
import { TONE_CLASS } from '../deck/deck-model'
import { OfferBadge, OfferPrice } from '../offer'
import type { useDish } from './use-dish'

/** The photo box of a list's dish: the photo, or the plate on the business's colour; its options grow out of it when opened */
export function DishPhotoBox({
  item,
  dish,
  photoRef,
  radius,
  className,
  children,
  offerSmall = false,
}: {
  item: CatalogItemDto
  dish: ReturnType<typeof useDish>
  photoRef: RefObject<HTMLDivElement | null>
  radius: number
  className?: string
  children?: ReactNode
  /** A small photo (a classic row's) carries the row-sized badge */
  offerSmall?: boolean
}) {
  return (
    <div
      ref={photoRef}
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
        <div className='bg-muted absolute inset-0'>
          <img src={itemPictureUrl(item, 640)} alt='' loading='lazy' decoding='async' draggable={false} onError={dish.fail} className='size-full object-cover' />
        </div>
      ) : (
        <div className='absolute inset-0 grid place-items-center'>
          <UtensilsCrossed className='size-1/3 max-w-12 opacity-40' />
        </div>
      )}
      {/* Sold out: said on the photo, where the eye is, unless the photo is a row's small one (its tag says it) */}
      {dish.soldOut && !offerSmall && (
        <span className='absolute start-2.5 top-2.5 z-10'>
          <SoldOutBadge />
        </span>
      )}
      {dish.onOffer && !dish.soldOut && (
        <span className={cn('absolute z-10', offerSmall ? 'start-1 top-1' : 'start-2.5 top-2.5')}>
          <OfferBadge item={item} photo={!offerSmall} />
        </span>
      )}
      {children}
    </div>
  )
}

/** "Sold out" on a dish's photo, dark and quiet over the greyed picture */
export function SoldOutBadge() {
  const t = useT()
  return <span className='rounded-full bg-black/70 px-3 py-1 text-caption font-semibold text-white'>{t('soldOut')}</span>
}

/** Where a dish's add button stands, when there is none to add: says it is sold out */
export function SoldOutTag({ className }: { className?: string }) {
  const t = useT()
  return (
    <span className={cn('bg-muted text-muted-foreground inline-flex h-9 shrink-0 items-center rounded-full px-3 text-caption font-semibold', className)}>
      {t('soldOut')}
    </span>
  )
}

/** The price: under an offer the new one in the offer's colour, the old one struck beside it */
export function DishPrice({ item, className }: { item: CatalogItemDto; onOffer?: boolean; className?: string }) {
  return <OfferPrice item={item} className={cn('flex', className)} />
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
  // How many of this dish are in the tray, as a number: every row on the menu has one of these, and
  // following the whole cart re-rendered them all on each line added anywhere
  const count = useCart((s) => s.lines.reduce((sum, l) => (l.productId === Number(item.id) ? sum + l.quantity : sum), 0))
  const setQuantity = useCart((s) => s.setQuantity)
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
    const newest = useCart
      .getState()
      .lines.filter((l) => l.productId === Number(item.id))
      .at(-1)
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

