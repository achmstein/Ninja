import { ChevronRight, Heart, Minus, Plus, Utensils } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import type { MenuItemLayout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImageWithFallback } from '@/components/image-fallback'
import { Skeleton } from '@/components/ui/skeleton'

export function itemPictureUrl(id: number | string | undefined): string {
  return `/api/catalog/items/${id}/pic`
}

export interface ItemRowProps {
  item: CatalogItemDto
  isFavorite: boolean
  canFavorite: boolean
  onToggleFavorite: (itemId: number) => void
  onCustomize: (item: CatalogItemDto) => void
  orderingEnabled: boolean
}

/**
 * How a list of items is laid out for each way the style shows an item: rows
 * and text in two columns on wide screens, tiles in a grid, wide photos two
 * abreast. Gaps scale with the style's density.
 */
export function menuListClass(variant: MenuItemLayout): string {
  switch (variant) {
    case 'card':
      return 'grid grid-cols-2 gap-[calc(0.75rem*var(--space))] sm:grid-cols-3 lg:grid-cols-4'
    case 'hero':
      return 'grid gap-[calc(1rem*var(--space))] md:grid-cols-2'
    case 'compact':
      return 'md:grid md:grid-cols-2 md:gap-x-12'
    default:
      return 'md:grid md:grid-cols-2 md:gap-x-10'
  }
}

/** One item on the menu, dressed as the style says; every way adds, steps and favours the same. */
export function MenuItem({ variant, ...props }: ItemRowProps & { variant: MenuItemLayout }) {
  switch (variant) {
    case 'card':
      return <ItemCard {...props} />
    case 'compact':
      return <ItemCompact {...props} />
    case 'hero':
      return <ItemHero {...props} />
    default:
      return <ItemRow {...props} />
  }
}

/** The cart side of an item: whether it is on offer, its plain line, and what a tap does. */
function useItemActions(item: CatalogItemDto, orderingEnabled: boolean, onCustomize: (item: CatalogItemDto) => void) {
  const { lines, add } = useCart()

  const hasCustomizations = (item.customizations?.length ?? 0) > 0
  // The stepper only controls the plain line of this item
  const simpleLine = lines.find(
    (line) =>
      line.productId === Number(item.id) &&
      line.customizations.length === 0 &&
      !line.specialInstructions
  )

  const onOffer =
    item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
  const effectivePrice = onOffer ? item.offerPrice : item.price

  // No toast on add — the cart bar's count/total updating is the feedback
  const addSimple = () => {
    add({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: Number(effectivePrice ?? 0),
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity: 1,
      customizations: [],
    })
  }

  const handleOpen = () => {
    if (!orderingEnabled || !item.isAvailable) return
    if (hasCustomizations) {
      onCustomize(item)
    } else {
      addSimple()
    }
  }

  const canOrder = orderingEnabled && (item.isAvailable ?? true)

  return { hasCustomizations, simpleLine, onOffer, effectivePrice, handleOpen, canOrder }
}

/** The add button, or the stepper once the plain item is in the cart. Round unless the style squares its buttons. */
function AddControl({
  actions,
  className,
}: {
  actions: ReturnType<typeof useItemActions>
  className?: string
}) {
  const t = useT()
  const setQuantity = useCart((s) => s.setQuantity)
  const { simpleLine, hasCustomizations, handleOpen } = actions

  if (simpleLine) {
    return (
      <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
        <Button
          variant='outline'
          size='icon'
          className='size-8 rounded-(--radius-round)'
          aria-label='Decrease'
          onClick={() =>
            setQuantity(lineKey(simpleLine), simpleLine.quantity - 1)
          }
        >
          <Minus className='h-3.5 w-3.5' />
        </Button>
        <span className='w-4 text-center text-sm font-semibold tabular-nums'>
          {simpleLine.quantity}
        </span>
        <Button
          variant='outline'
          size='icon'
          className='size-8 rounded-(--radius-round)'
          aria-label='Increase'
          onClick={() =>
            setQuantity(lineKey(simpleLine), simpleLine.quantity + 1)
          }
        >
          <Plus className='h-3.5 w-3.5' />
        </Button>
      </div>
    )
  }

  // Same round button; chevron when the item opens the options sheet
  return (
    <Button
      size='icon'
      className={cn('size-8 shrink-0 rounded-(--radius-round)', className)}
      aria-label={hasCustomizations ? t('customizable') : t('addToCart')}
      onClick={handleOpen}
    >
      {hasCustomizations ? (
        <ChevronRight className='h-4 w-4 rtl:rotate-180' />
      ) : (
        <Plus className='h-4 w-4' />
      )}
    </Button>
  )
}

function FavoriteButton({
  item,
  isFavorite,
  onToggleFavorite,
  className,
  onPhoto = true,
}: {
  item: CatalogItemDto
  isFavorite: boolean
  onToggleFavorite: (itemId: number) => void
  className?: string
  /** White with a shadow over a photo; the text's colour beside text */
  onPhoto?: boolean
}) {
  const t = useT()
  return (
    <button
      type='button'
      aria-label={t('favorites')}
      className={className}
      onClick={() => onToggleFavorite(Number(item.id))}
    >
      <Heart
        className={cn(
          'h-4 w-4',
          onPhoto && 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]',
          isFavorite
            ? 'fill-red-500 text-red-500'
            : onPhoto
              ? 'text-white'
              : 'text-muted-foreground'
        )}
      />
    </button>
  )
}

/** The price, the offer's in green with the old one struck through beside it. */
function PriceBlock({
  item,
  actions,
  className,
  inline = false,
}: {
  item: CatalogItemDto
  actions: ReturnType<typeof useItemActions>
  className?: string
  /** Old price on the same line rather than under */
  inline?: boolean
}) {
  const price = usePrice()
  return (
    <div className={cn(inline ? 'flex items-baseline gap-2' : '', className)}>
      <div
        className={cn(
          'text-sm font-bold',
          actions.onOffer && 'text-green-600 dark:text-green-500'
        )}
      >
        {price(actions.effectivePrice)}
      </div>
      {actions.onOffer && (
        <div className='text-muted-foreground text-xs line-through'>
          {price(item.price)}
        </div>
      )}
    </div>
  )
}

/**
 * Menu list row, mirroring the mobile app's tile: 64px picture with heart
 * overlay and offer ribbon, name/description/price, and an add button or
 * quantity stepper at the end. The classic style's item.
 */
export function ItemRow({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
}: ItemRowProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useItemActions(item, orderingEnabled, onCustomize)

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b py-[calc(0.75rem*var(--space))] last:border-b-0',
        !item.isAvailable && 'opacity-50'
      )}
    >
      {/* Picture with heart overlay and offer ribbon */}
      <div className='relative shrink-0'>
        <button
          type='button'
          className='block'
          onClick={actions.handleOpen}
          aria-label={localized(item.name)}
        >
          <ImageWithFallback
            src={item.pictureUri ? itemPictureUrl(item.id) : null}
            className='size-16 rounded-lg'
            fallbackIcon={
              <Utensils className='text-muted-foreground h-6 w-6' />
            }
          />
        </button>
        {canFavorite && (
          <FavoriteButton
            item={item}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            className='absolute start-1 top-1'
          />
        )}
        {actions.onOffer && (
          <span className='absolute inset-x-0 bottom-0 rounded-b-lg bg-green-600 py-0.5 text-center text-[10px] font-bold text-white'>
            {t('offer')}
          </span>
        )}
      </div>

      {/* Name / description / price */}
      <button
        type='button'
        className='min-w-0 flex-1 text-start'
        onClick={actions.handleOpen}
      >
        <div className='text-[15px] font-semibold'>{localized(item.name)}</div>
        {localized(item.description) && (
          <p className='text-muted-foreground line-clamp-2 text-[13px]'>
            {localized(item.description)}
          </p>
        )}
        <PriceBlock item={item} actions={actions} className='mt-0.5' />
        {!item.isAvailable && (
          <span className='text-muted-foreground text-xs'>
            {t('unavailable')}
          </span>
        )}
      </button>

      {/* Add / stepper / fast order */}
      {actions.canOrder && <AddControl actions={actions} />}
    </div>
  )
}

/** A photo tile in a grid: the square picture, the add button on its corner, the name and price under it. */
function ItemCard({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
}: ItemRowProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useItemActions(item, orderingEnabled, onCustomize)

  return (
    <div
      className={cn(
        'surface flex min-w-0 flex-col overflow-hidden rounded-xl',
        !item.isAvailable && 'opacity-50'
      )}
    >
      <div className='relative'>
        <button
          type='button'
          className='block w-full'
          onClick={actions.handleOpen}
          aria-label={localized(item.name)}
        >
          <ImageWithFallback
            src={item.pictureUri ? itemPictureUrl(item.id) : null}
            className='aspect-square w-full'
            fallbackIcon={
              <Utensils className='text-muted-foreground/50 h-8 w-8' />
            }
          />
        </button>
        {canFavorite && (
          <FavoriteButton
            item={item}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            className='absolute start-2 top-2'
          />
        )}
        {actions.onOffer && (
          <span className='absolute end-2 top-2 rounded-pill bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white'>
            {t('offer')}
          </span>
        )}
        {actions.canOrder && (
          <AddControl
            actions={actions}
            className={cn(
              'absolute end-2 bottom-2 shadow-md',
              actions.simpleLine && 'bg-background/90 rounded-pill p-0.5 backdrop-blur'
            )}
          />
        )}
      </div>
      <button
        type='button'
        className='flex flex-1 flex-col gap-0.5 p-[calc(0.625rem*var(--space))] text-start'
        onClick={actions.handleOpen}
      >
        <div className='line-clamp-2 text-sm leading-snug font-semibold'>
          {localized(item.name)}
        </div>
        <PriceBlock item={item} actions={actions} inline className='mt-auto pt-1' />
        {!item.isAvailable && (
          <span className='text-muted-foreground text-xs'>
            {t('unavailable')}
          </span>
        )}
      </button>
    </div>
  )
}

/** Text only, as a printed menu sets it: the name, a dotted leader, the price; the description under. */
function ItemCompact({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
}: ItemRowProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useItemActions(item, orderingEnabled, onCustomize)
  const price = usePrice()

  return (
    <div
      className={cn(
        'flex items-start gap-3 py-[calc(0.75rem*var(--space))]',
        !item.isAvailable && 'opacity-50'
      )}
    >
      <button
        type='button'
        className='min-w-0 flex-1 text-start'
        onClick={actions.handleOpen}
      >
        <div className='flex items-baseline gap-2'>
          <span className='min-w-0 font-medium'>{localized(item.name)}</span>
          {actions.onOffer && (
            <span className='shrink-0 text-[10px] font-bold tracking-wide text-green-600 uppercase dark:text-green-500'>
              {t('offer')}
            </span>
          )}
          <span
            aria-hidden
            className='border-muted-foreground/40 min-w-4 flex-1 translate-y-[-0.3em] border-b border-dotted'
          />
          <span
            className={cn(
              'shrink-0 text-sm font-semibold tabular-nums',
              actions.onOffer && 'text-green-600 dark:text-green-500'
            )}
          >
            {price(actions.effectivePrice)}
          </span>
        </div>
        {actions.onOffer && (
          <div className='text-muted-foreground text-end text-xs line-through'>
            {price(item.price)}
          </div>
        )}
        {localized(item.description) && (
          <p className='text-muted-foreground mt-0.5 line-clamp-2 text-[13px]'>
            {localized(item.description)}
          </p>
        )}
        {!item.isAvailable && (
          <span className='text-muted-foreground text-xs'>
            {t('unavailable')}
          </span>
        )}
      </button>
      <div className='flex shrink-0 items-center gap-2'>
        {canFavorite && (
          <FavoriteButton
            item={item}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onPhoto={false}
          />
        )}
        {actions.canOrder && <AddControl actions={actions} />}
      </div>
    </div>
  )
}

/** A wide photo with the name, description and price under it: the dish is the page. */
function ItemHero({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
}: ItemRowProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useItemActions(item, orderingEnabled, onCustomize)

  return (
    <div
      className={cn(
        'surface flex min-w-0 flex-col overflow-hidden rounded-2xl',
        !item.isAvailable && 'opacity-50'
      )}
    >
      <div className='relative'>
        <button
          type='button'
          className='block w-full'
          onClick={actions.handleOpen}
          aria-label={localized(item.name)}
        >
          <ImageWithFallback
            src={item.pictureUri ? itemPictureUrl(item.id) : null}
            className='aspect-[16/9] w-full'
            fallbackIcon={
              <Utensils className='text-muted-foreground/50 h-10 w-10' />
            }
          />
        </button>
        {canFavorite && (
          <FavoriteButton
            item={item}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            className='absolute start-3 top-3'
          />
        )}
        {actions.onOffer && (
          <span className='absolute end-3 top-3 rounded-pill bg-green-600 px-2.5 py-1 text-xs font-bold text-white'>
            {t('offer')}
          </span>
        )}
      </div>
      <div className='flex items-end gap-3 p-[calc(1rem*var(--space))]'>
        <button
          type='button'
          className='min-w-0 flex-1 text-start'
          onClick={actions.handleOpen}
        >
          <div className='heading text-lg leading-tight'>{localized(item.name)}</div>
          {localized(item.description) && (
            <p className='text-muted-foreground mt-1 line-clamp-2 text-[13px]'>
              {localized(item.description)}
            </p>
          )}
          <PriceBlock item={item} actions={actions} inline className='mt-1.5' />
          {!item.isAvailable && (
            <span className='text-muted-foreground text-xs'>
              {t('unavailable')}
            </span>
          )}
        </button>
        {actions.canOrder && <AddControl actions={actions} />}
      </div>
    </div>
  )
}

/**
 * Loading placeholder for each way an item shows.
 *
 * Deliberately lives beside the components it imitates and repeats their
 * container classes verbatim, so a change to an item is made with its
 * placeholder in view. A generic bar of roughly the right height leaves the
 * page still shifting when the real items land.
 */
export function MenuItemSkeleton({ variant }: { variant: MenuItemLayout }) {
  if (variant === 'card') {
    return (
      <div className='surface flex min-w-0 flex-col overflow-hidden rounded-xl'>
        <Skeleton className='aspect-square w-full rounded-none' />
        <div className='space-y-2 p-[calc(0.625rem*var(--space))]'>
          <Skeleton className='h-4 w-4/5' />
          <Skeleton className='h-4 w-12' />
        </div>
      </div>
    )
  }
  if (variant === 'hero') {
    return (
      <div className='surface flex min-w-0 flex-col overflow-hidden rounded-2xl'>
        <Skeleton className='aspect-[16/9] w-full rounded-none' />
        <div className='space-y-2 p-[calc(1rem*var(--space))]'>
          <Skeleton className='h-5 w-2/5' />
          <Skeleton className='h-3 w-4/5' />
          <Skeleton className='h-4 w-16' />
        </div>
      </div>
    )
  }
  if (variant === 'compact') {
    return (
      <div className='flex items-start gap-3 py-[calc(0.75rem*var(--space))]'>
        <div className='min-w-0 flex-1 space-y-2'>
          <Skeleton className='h-4 w-3/5' />
          <Skeleton className='h-3 w-4/5' />
        </div>
        <Skeleton className='size-8 shrink-0 rounded-(--radius-round)' />
      </div>
    )
  }
  return <ItemRowSkeleton />
}

/** Loading placeholder for ItemRow. */
export function ItemRowSkeleton() {
  return (
    <div className='flex items-center gap-3 border-b py-[calc(0.75rem*var(--space))] last:border-b-0'>
      {/* Picture */}
      <Skeleton className='size-16 shrink-0 rounded-lg' />

      {/* Name, description, price */}
      <div className='min-w-0 flex-1 space-y-2'>
        <Skeleton className='h-4 w-2/5' />
        <Skeleton className='h-3 w-4/5' />
        <Skeleton className='h-4 w-16' />
      </div>

      {/* Add button */}
      <Skeleton className='size-8 shrink-0 rounded-(--radius-round)' />
    </div>
  )
}
