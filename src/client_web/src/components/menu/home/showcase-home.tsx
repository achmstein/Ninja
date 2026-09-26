import { useState } from 'react'
import { ChevronRight, Minus, Plus, Search, Utensils } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { useBrand, useBrandName } from '@/lib/brand'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BrandWordmark } from '@/components/brand-mark'
import { ImageWithFallback } from '@/components/image-fallback'
import { InstallBanner } from '@/components/install-banner'
import {
  AddControl,
  FavoriteButton,
  PriceBlock,
  itemPictureUrl,
  useItemActions,
  type ItemRowProps,
} from '@/components/menu/item-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { pickHero, type MenuSectionData } from './sections'
import { MenuSearchInput, OrderingPausedNote, PlaceChips } from './shared'
import type { HomeProps } from './use-menu'

/**
 * Showcase: the menu as a delivery app lays it out. One dish up top as a
 * wide photo with a big add button, then a sideways row of photos per
 * section (the first, the most popular, in wider cards), each row opening
 * into a grid with "See all". The rows are the navigation, so there is no
 * category rail; search waits behind an icon in the top bar.
 */
export function ShowcaseHome({ menu, children }: HomeProps) {
  const t = useT()
  const [searching, setSearching] = useState(false)
  const hero = pickHero(menu.offerItems, menu.sections)

  // Popular first (the wide row), then the offers, then the rest as the list orders them
  const popular = menu.sections.find((s) => s.kind === 'popular')
  const offers: MenuSectionData | null =
    menu.offerItems.length > 0
      ? { id: 'section-offers', label: t('specialOffers'), kind: 'offers', items: menu.offerItems }
      : null
  const rows = [popular, offers, ...menu.sections.filter((s) => s.kind !== 'popular')].filter(
    (s): s is MenuSectionData => !!s
  )

  return (
    <div className='flex flex-col gap-6 px-4 pt-3 pb-4 md:pt-6'>
      {/* The top bar: the brand, then search behind an icon and the place chips */}
      <div className='flex min-h-11 items-center gap-2'>
        {searching ? (
          <>
            <MenuSearchInput
              value={menu.search}
              onChange={menu.setSearch}
              autoFocus
              className='min-w-0 flex-1'
              inputClassName='h-11 border-0 bg-muted shadow-none'
            />
            <Button
              variant='ghost'
              size='sm'
              className='shrink-0 rounded-pill'
              onClick={() => {
                menu.setSearch('')
                setSearching(false)
              }}
            >
              {t('cancel')}
            </Button>
          </>
        ) : (
          <>
            <div className='flex min-w-0 flex-1 items-center gap-2 md:hidden'>
              <BrandWordmark className='max-w-[55vw]' />
            </div>
            {/* A wide screen has the room to show the box itself */}
            <MenuSearchInput
              value={menu.search}
              onChange={menu.setSearch}
              className='ms-auto hidden w-full max-w-sm md:block'
              inputClassName='h-11 border-0 bg-muted shadow-none'
            />
            <button
              type='button'
              aria-label={t('searchMenu')}
              className='bg-muted text-foreground hover:bg-accent grid size-11 shrink-0 place-items-center rounded-full transition-colors md:hidden'
              onClick={() => setSearching(true)}
            >
              <Search className='size-[1.15rem]' />
            </button>
            <PlaceChips />
          </>
        )}
      </div>

      {!menu.orderingEnabled && <OrderingPausedNote />}
      <InstallBanner />

      {menu.isLoading ? (
        <ShowcaseSkeleton />
      ) : menu.term ? (
        menu.searchResults.length === 0 ? (
          <p className='text-muted-foreground py-16 text-center'>{t('noItemsAvailable')}</p>
        ) : (
          <div className='grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5'>
            {menu.searchResults.map((item) => (
              <ShowcaseCard key={String(item.id)} size='grid' {...menu.itemProps(item)} />
            ))}
          </div>
        )
      ) : (
        <>
          {hero ? <Hero {...menu.itemProps(hero)} /> : <CoverHero />}
          {rows.map((section, index) => (
            <ShowcaseRow
              key={section.id}
              section={section}
              wide={index === 0 && section.kind === 'popular'}
              itemProps={menu.itemProps}
            />
          ))}
        </>
      )}

      {children}
    </div>
  )
}

/** The dish the page opens with: a wide photo, its name and price over it, and a big add button. */
function Hero(props: ItemRowProps) {
  const { item, orderingEnabled, onCustomize } = props
  const t = useT()
  const localized = useLocalized()
  const actions = useItemActions(item, orderingEnabled, onCustomize)
  const setQuantity = useCart((s) => s.setQuantity)
  const { simpleLine } = actions

  return (
    <section className='relative isolate overflow-hidden rounded-3xl shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]'>
      <button
        type='button'
        className='block w-full'
        onClick={actions.handleOpen}
        aria-label={localized(item.name)}
      >
        <ImageWithFallback
          src={itemPictureUrl(item.id)}
          className='aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-auto lg:h-[26rem]'
          fallbackIcon={<Utensils className='text-muted-foreground/50 h-10 w-10' />}
        />
      </button>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent'
      />
      <div className='pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-x-4 gap-y-3 p-5 text-white md:p-8'>
        <div className='min-w-0 flex-1 basis-48'>
          <span className='bg-primary text-primary-foreground mb-2 inline-block rounded-pill px-2.5 py-0.5 text-xs font-semibold'>
            {actions.onOffer ? t('offer') : t('mostPopular')}
          </span>
          <h2 className='heading line-clamp-2 text-[calc(1.75rem*var(--heading-scale))] leading-[1.05] md:text-[calc(2.5rem*var(--heading-scale))]'>
            {localized(item.name)}
          </h2>
          {localized(item.description) && (
            <p className='mt-1 line-clamp-1 max-w-prose text-sm text-white/75'>{localized(item.description)}</p>
          )}
          <PriceBlock
            item={item}
            actions={actions}
            inline
            className='mt-2 [&>div:first-child]:text-lg [&>div:first-child]:text-white [&>div:last-child]:text-white/70'
          />
        </div>
        {actions.canOrder &&
          (simpleLine ? (
            <div className='pointer-events-auto flex h-12 shrink-0 items-center gap-1 rounded-pill bg-white p-1 text-black shadow-lg'>
              <button
                type='button'
                aria-label='Decrease'
                className='grid size-10 place-items-center rounded-full hover:bg-black/5'
                onClick={() => setQuantity(lineKey(simpleLine), simpleLine.quantity - 1)}
              >
                <Minus className='size-4' />
              </button>
              <span className='w-6 text-center font-semibold tabular-nums'>{simpleLine.quantity}</span>
              <button
                type='button'
                aria-label='Increase'
                className='grid size-10 place-items-center rounded-full hover:bg-black/5'
                onClick={() => setQuantity(lineKey(simpleLine), simpleLine.quantity + 1)}
              >
                <Plus className='size-4' />
              </button>
            </div>
          ) : (
            <Button
              size='lg'
              className='pointer-events-auto h-12 shrink-0 rounded-pill px-6 text-base font-semibold shadow-lg'
              onClick={actions.handleOpen}
            >
              {actions.hasCustomizations ? (
                <>
                  {t('customizable')}
                  <ChevronRight className='rtl:rotate-180' />
                </>
              ) : (
                <>
                  <Plus className='size-5' />
                  {t('addToCart')}
                </>
              )}
            </Button>
          ))}
      </div>
    </section>
  )
}

/** Without a photographed dish the café's cover opens the page, or its name on its colour. */
function CoverHero() {
  const brand = useBrand()
  const name = useBrandName()
  const cover = brand?.cover
  return (
    <section
      className={cn(
        'relative isolate flex aspect-[16/9] items-end overflow-hidden rounded-3xl p-6 lg:aspect-auto lg:h-[26rem]',
        cover ? 'text-white' : 'bg-primary text-primary-foreground'
      )}
    >
      {cover && (
        <>
          <img src={cover.url} alt='' className='absolute inset-0 -z-10 size-full object-cover' />
          <div aria-hidden className='absolute inset-0 -z-10 bg-gradient-to-t from-black/75 to-transparent' />
        </>
      )}
      <h1 className='heading text-[calc(2rem*var(--heading-scale))] leading-none'>{name}</h1>
    </section>
  )
}

/** One section as a sideways row of photos, or, once opened with "See all", as a grid. */
function ShowcaseRow({
  section,
  wide,
  itemProps,
}: {
  section: MenuSectionData
  wide: boolean
  itemProps: (item: CatalogItemDto) => ItemRowProps
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // A row that fits without scrolling has nothing more to show
  const canOpen = section.items.length > (wide ? 1 : 2)

  return (
    <section id={section.id} className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='heading min-w-0 truncate text-[calc(1.25rem*var(--heading-scale))] leading-tight'>
          {section.label}
        </h2>
        {canOpen && (
          <button
            type='button'
            aria-expanded={open}
            className='text-primary shrink-0 text-sm font-semibold hover:underline'
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t('showLess') : t('seeAll')}
          </button>
        )}
      </div>
      {open ? (
        <div className='grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5'>
          {section.items.map((item) => (
            <ShowcaseCard key={String(item.id)} size='grid' {...itemProps(item)} />
          ))}
        </div>
      ) : (
        <div className='no-scrollbar -mx-4 -my-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-4'>
          {section.items.map((item) => (
            <ShowcaseCard
              key={String(item.id)}
              size={wide ? 'wide' : 'small'}
              className={cn(
                'shrink-0 snap-start',
                wide ? 'w-[70%] sm:w-80 lg:w-96' : 'w-[40%] sm:w-44 lg:w-52'
              )}
              {...itemProps(item)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** A dish as a big rounded photo on a soft shadow, the add button on its corner, the name and price under it. */
function ShowcaseCard({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
  size,
  className,
}: ItemRowProps & { size: 'wide' | 'small' | 'grid'; className?: string }) {
  const t = useT()
  const localized = useLocalized()
  const actions = useItemActions(item, orderingEnabled, onCustomize)

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', !item.isAvailable && 'opacity-50', className)}>
      <div className='relative'>
        <button
          type='button'
          className='block w-full overflow-hidden rounded-2xl shadow-[0_12px_28px_-14px_rgb(0_0_0/0.45)] dark:shadow-none'
          onClick={actions.handleOpen}
          aria-label={localized(item.name)}
        >
          <ImageWithFallback
            src={item.pictureUri ? itemPictureUrl(item.id) : null}
            className={cn('w-full', size === 'wide' ? 'aspect-[4/3]' : 'aspect-square')}
            fallbackIcon={<Utensils className='text-muted-foreground/50 h-8 w-8' />}
          />
        </button>
        {canFavorite && (
          <FavoriteButton
            item={item}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            className='absolute start-2.5 top-2.5'
          />
        )}
        {actions.onOffer && (
          <span className='absolute end-2.5 top-2.5 rounded-pill bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white'>
            {t('offer')}
          </span>
        )}
        {actions.canOrder && (
          <AddControl
            actions={actions}
            className={cn(
              'absolute end-2 bottom-2 shadow-lg',
              actions.simpleLine && 'bg-background/90 rounded-pill p-0.5 backdrop-blur'
            )}
          />
        )}
      </div>
      <button type='button' className='min-w-0 px-0.5 text-start' onClick={actions.handleOpen}>
        <div className={cn('truncate font-semibold', size === 'wide' ? 'text-base' : 'text-sm')}>
          {localized(item.name)}
        </div>
        {size === 'wide' && localized(item.description) && (
          <p className='text-muted-foreground truncate text-[13px]'>{localized(item.description)}</p>
        )}
        <PriceBlock item={item} actions={actions} inline className='mt-0.5' />
      </button>
    </div>
  )
}

function ShowcaseSkeleton() {
  return (
    <>
      <Skeleton className='aspect-[4/3] w-full rounded-3xl sm:aspect-[16/9] lg:aspect-auto lg:h-[26rem]' />
      {[0, 1].map((row) => (
        <div key={row} className='flex flex-col gap-3'>
          <Skeleton className='h-6 w-40' />
          <div className='flex gap-3 overflow-hidden'>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn('aspect-square shrink-0 rounded-2xl', row === 0 ? 'w-[70%] sm:w-80' : 'w-[40%] sm:w-44')} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
