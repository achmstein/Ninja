import { Minus, Plus, Utensils } from 'lucide-react'
import { useBrandName } from '@/lib/brand'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ImageWithFallback } from '@/components/image-fallback'
import { InstallBanner } from '@/components/install-banner'
import { FavoriteButton, itemPictureUrl, useItemActions, type ItemRowProps } from '@/components/menu/item-card'
import { Skeleton } from '@/components/ui/skeleton'
import { posterTone, type MenuSectionData, type PosterTone } from './sections'
import { useHeavyBrandFonts } from './page-effects'
import { MenuSearchInput, OrderingPausedNote, PlaceChips } from './shared'
import type { HomeProps } from './use-menu'

const TONE: Record<PosterTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  deep: 'poster-deep',
}

/**
 * Poster: loud and playful. The café's name huge on its colour, then each
 * section a full-width block of colour in turn (the primary, the accent, a
 * darkened primary) under a huge heavy title, its dishes as chunky cards
 * with round cut-out photos, a slight tilt and the price as a sticker.
 * Presses bounce, unless the device asks for less motion.
 */
export function PosterHome({ menu, children }: HomeProps) {
  const t = useT()
  const name = useBrandName()
  useHeavyBrandFonts()

  const blocks: MenuSectionData[] = [
    ...(menu.offerItems.length > 0
      ? [{ id: 'section-offers', label: t('specialOffers'), kind: 'offers' as const, items: menu.offerItems }]
      : []),
    ...menu.sections,
  ]

  return (
    <div className='poster flex flex-col overflow-x-clip md:gap-4 md:p-4'>
      {/* The masthead: the name as big as it goes, on the brand's colour */}
      <header className='bg-primary text-primary-foreground flex flex-col gap-5 px-5 pt-4 pb-6 md:rounded-[2rem] md:px-10 md:pt-10 md:pb-10'>
        <PlaceChips className='justify-end' />
        <h1 className='poster-title text-[clamp(3.25rem,17vw,8.5rem)] break-words'>{name}</h1>
        <MenuSearchInput
          value={menu.search}
          onChange={menu.setSearch}
          className='max-w-xl [&_svg]:text-foreground/60'
          inputClassName='h-12 border-2 border-current bg-background text-foreground text-base font-semibold shadow-[4px_4px_0_rgb(0_0_0/0.85)] rtl:shadow-[-4px_4px_0_rgb(0_0_0/0.85)]'
        />
      </header>

      <div className='flex flex-col gap-3 p-4 empty:hidden md:p-0'>
        {!menu.orderingEnabled && <OrderingPausedNote />}
        <InstallBanner />
      </div>

      {menu.isLoading ? (
        <div className='flex flex-col gap-4 p-5'>
          <Skeleton className='h-16 w-3/4' />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-32 rounded-[1.75rem]' />
          ))}
        </div>
      ) : menu.term ? (
        <section className='bg-muted px-5 py-8 md:rounded-[2rem] md:px-10'>
          {menu.searchResults.length === 0 ? (
            <p className='poster-title py-10 text-center text-3xl opacity-60'>{t('noItemsAvailable')}</p>
          ) : (
            <PosterGrid items={menu.searchResults} itemProps={menu.itemProps} />
          )}
        </section>
      ) : (
        blocks.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className={cn('px-5 pt-8 pb-10 md:rounded-[2rem] md:px-10 md:pt-10', TONE[posterTone(index + 1)])}
          >
            <h2 className='poster-title mb-7 text-[clamp(2.5rem,13vw,5.5rem)] break-words'>{section.label}</h2>
            <PosterGrid items={section.items} itemProps={menu.itemProps} />
          </section>
        ))
      )}

      <div className='px-4'>{children}</div>
    </div>
  )
}

function PosterGrid({
  items,
  itemProps,
}: {
  items: MenuSectionData['items']
  itemProps: HomeProps['menu']['itemProps']
}) {
  return (
    <div className='grid gap-x-5 gap-y-9 pt-4 md:grid-cols-2 xl:grid-cols-3'>
      {items.map((item, i) => (
        <PosterCard key={String(item.id)} tilt={i % 2 === 0 ? 'left' : 'right'} {...itemProps(item)} />
      ))}
    </div>
  )
}

/** A dish as a chunky card: a round cut-out photo breaking out of its corner, the name heavy, the price a sticker. */
function PosterCard({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
  tilt,
}: ItemRowProps & { tilt: 'left' | 'right' }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const actions = useItemActions(item, orderingEnabled, onCustomize)
  const setQuantity = useCart((s) => s.setQuantity)
  const { simpleLine } = actions

  return (
    <div
      className={cn(
        'poster-card bg-background text-foreground relative flex min-w-0 gap-4 rounded-[1.75rem] border-2 border-current p-4 pt-5',
        tilt === 'left' ? 'poster-tilt-left' : 'poster-tilt-right',
        !item.isAvailable && 'opacity-60'
      )}
    >
      <button
        type='button'
        className='poster-press -mt-10 -ms-2 shrink-0 self-start'
        onClick={actions.handleOpen}
        aria-label={localized(item.name)}
      >
        <ImageWithFallback
          src={item.pictureUri ? itemPictureUrl(item.id) : null}
          className='border-foreground size-24 rounded-full min-[400px]:size-28 border-[3px] shadow-[4px_4px_0_var(--foreground)] rtl:shadow-[-4px_4px_0_var(--foreground)]'
          fallbackIcon={<Utensils className='text-muted-foreground size-8' />}
        />
      </button>

      <div className='flex min-w-0 flex-1 flex-col'>
        <button type='button' className='min-w-0 text-start' onClick={actions.handleOpen}>
          <div className='poster-name text-lg leading-[1.05]'>{localized(item.name)}</div>
          {localized(item.description) && (
            <p className='text-muted-foreground mt-1 line-clamp-2 text-[13px] leading-snug'>
              {localized(item.description)}
            </p>
          )}
          {!item.isAvailable && <p className='text-muted-foreground mt-1 text-xs'>{t('unavailable')}</p>}
        </button>

        {actions.onOffer && (
          <span className='text-muted-foreground mt-2 text-xs font-bold line-through'>{price(item.price)}</span>
        )}
        <div className='mt-auto flex flex-wrap items-end justify-between gap-2 pt-2'>
          {/* The sticker */}
          <span className='poster-sticker'>{price(actions.effectivePrice)}</span>

          {actions.canOrder &&
            (simpleLine ? (
              <div className='bg-primary text-primary-foreground flex h-11 shrink-0 items-center rounded-pill border-2 border-current p-0.5'>
                <button
                  type='button'
                  aria-label='Decrease'
                  className='poster-press grid size-9 place-items-center rounded-full'
                  onClick={() => setQuantity(lineKey(simpleLine), simpleLine.quantity - 1)}
                >
                  <Minus className='size-4' strokeWidth={3} />
                </button>
                <span className='w-5 text-center font-black tabular-nums'>{simpleLine.quantity}</span>
                <button
                  type='button'
                  aria-label='Increase'
                  className='poster-press grid size-9 place-items-center rounded-full'
                  onClick={() => setQuantity(lineKey(simpleLine), simpleLine.quantity + 1)}
                >
                  <Plus className='size-4' strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                type='button'
                aria-label={actions.hasCustomizations ? t('customizable') : t('addToCart')}
                className='poster-press bg-primary text-primary-foreground border-foreground grid size-12 shrink-0 place-items-center rounded-full border-2 shadow-[3px_3px_0_var(--foreground)] rtl:shadow-[-3px_3px_0_var(--foreground)]'
                onClick={actions.handleOpen}
              >
                <Plus className='size-6' strokeWidth={3} />
              </button>
            ))}
        </div>
      </div>

      {canFavorite && (
        <FavoriteButton
          item={item}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          onPhoto={false}
          className='absolute end-3 top-3'
        />
      )}
    </div>
  )
}
