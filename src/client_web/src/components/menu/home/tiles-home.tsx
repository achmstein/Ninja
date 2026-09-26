import { useState } from 'react'
import { ArrowLeft, Heart, Percent, Repeat2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ImageWithFallback } from '@/components/image-fallback'
import { InstallBanner } from '@/components/install-banner'
import { MenuItem, MenuItemSkeleton, itemPictureUrl, menuListClass } from '@/components/menu/item-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { coverItem, tileSections, type MenuSectionData } from './sections'
import { MenuSearchInput, OrderingPausedNote } from './shared'
import type { HomeProps } from './use-menu'

/**
 * Tiles: the categories first, for a big menu. The page is a grid of big
 * tiles, one per category with its first dish's photo under the name and
 * how many there are; the offers and your usuals lead as tiles of their
 * own. A tile opens its dishes as a photo grid in place, with a back arrow
 * and the other tiles as chips to hop between.
 */
export function TilesHome({ menu, children }: HomeProps) {
  const t = useT()
  const tiles = tileSections(menu.sections, menu.offerItems, t('specialOffers'))
  const [openId, setOpenId] = useState<string | null>(null)
  const open = tiles.find((s) => s.id === openId) ?? null

  const openTile = (id: string | null) => {
    setOpenId(id)
    window.scrollTo({ top: 0 })
  }

  const renderItem = (item: MenuSectionData['items'][number]) => (
    <MenuItem key={String(item.id)} variant='card' {...menu.itemProps(item)} />
  )

  return (
    <div className='flex flex-col gap-4 p-4'>
      {!menu.orderingEnabled && <OrderingPausedNote />}
      {!open && <InstallBanner />}

      {!open && <MenuSearchInput value={menu.search} onChange={menu.setSearch} inputClassName='h-11' />}

      {menu.isLoading ? (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className='aspect-[4/5] rounded-2xl' />
          ))}
        </div>
      ) : menu.term ? (
        menu.searchResults.length === 0 ? (
          <p className='text-muted-foreground py-16 text-center'>{t('noItemsAvailable')}</p>
        ) : (
          <div className={menuListClass('card')}>{menu.searchResults.map(renderItem)}</div>
        )
      ) : open ? (
        <>
          {/* The open tile: back, its name, and the others to hop to */}
          <div className='bg-background/95 sticky top-[env(safe-area-inset-top)] z-30 -mx-4 flex flex-col gap-2 px-4 pt-3 pb-2 backdrop-blur md:top-(--header-h)'>
            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='icon'
                className='-ms-2 size-10 shrink-0 rounded-full'
                aria-label={t('back')}
                onClick={() => openTile(null)}
              >
                <ArrowLeft className='size-5 rtl:rotate-180' />
              </Button>
              <h1 className='heading min-w-0 flex-1 truncate text-[calc(1.35rem*var(--heading-scale))]'>
                {open.label}
              </h1>
              <span className='text-muted-foreground shrink-0 text-sm'>
                {t('itemCount', { count: open.items.length })}
              </span>
            </div>
            <div className='no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4'>
              {tiles.map((tile) => (
                <Button
                  key={tile.id}
                  size='sm'
                  variant={tile.id === open.id ? 'default' : 'outline'}
                  className='shrink-0 rounded-pill'
                  onClick={() => openTile(tile.id)}
                >
                  {tile.label}
                </Button>
              ))}
            </div>
          </div>
          <div className={menuListClass('card')}>{open.items.map(renderItem)}</div>
        </>
      ) : tiles.length === 0 ? (
        <div className={menuListClass('card')}>
          {[...Array(4)].map((_, i) => (
            <MenuItemSkeleton key={i} variant='card' />
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
          {tiles.map((tile, i) => (
            <Tile
              key={tile.id}
              section={tile}
              onOpen={() => openTile(tile.id)}
              // An odd one out at the foot of a phone's two columns takes the row
              className={cn(
                i === tiles.length - 1 && tiles.length % 2 === 1 && 'max-sm:col-span-2 max-sm:aspect-[2/1]'
              )}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  )
}

/**
 * A category as a big tile: its first dish's photo (or its colour and
 * initial) under a scrim, the name and the count at the foot. The offers,
 * your usuals and your favourites are tiles in the brand's colours with
 * their dishes as a stack of round photos.
 */
function Tile({ section, onOpen, className }: { section: MenuSectionData; onOpen: () => void; className?: string }) {
  const t = useT()
  const count = t('itemCount', { count: section.items.length })

  if (section.kind !== 'category') {
    const Icon = section.kind === 'offers' ? Percent : section.kind === 'usuals' ? Repeat2 : Heart
    const photos = section.items.filter((i) => i.pictureUri).slice(0, 3)
    return (
      <button
        type='button'
        onClick={onOpen}
        className={cn(
          'group relative isolate flex aspect-[4/5] flex-col lg:aspect-square justify-between overflow-hidden rounded-2xl p-4 text-start transition-transform active:scale-[0.98] motion-reduce:transform-none',
          section.kind === 'offers' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
          className
        )}
      >
        <Icon aria-hidden className='absolute -end-6 -top-6 -z-10 size-36 opacity-15' strokeWidth={1.5} />
        <div className='flex -space-x-3 rtl:space-x-reverse'>
          {photos.map((item) => (
            <img
              key={String(item.id)}
              src={itemPictureUrl(item.id)}
              alt=''
              loading='lazy'
              className='size-12 rounded-full object-cover ring-2 ring-current/30'
            />
          ))}
        </div>
        <div>
          <div className='heading text-[calc(1.25rem*var(--heading-scale))] leading-tight'>{section.label}</div>
          <div className='mt-0.5 text-sm opacity-80'>{count}</div>
        </div>
      </button>
    )
  }

  const cover = coverItem(section)
  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'group relative isolate flex aspect-[4/5] flex-col lg:aspect-square justify-end overflow-hidden rounded-2xl text-start text-white transition-transform active:scale-[0.98] motion-reduce:transform-none',
        className
      )}
    >
      {cover ? (
        <ImageWithFallback
          src={itemPictureUrl(cover.id)}
          className='absolute inset-0 -z-20 size-full transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none'
          fallbackIcon={null}
        />
      ) : (
        <div
          aria-hidden
          className='from-primary absolute inset-0 -z-20 grid place-items-center bg-gradient-to-br to-[color-mix(in_oklab,var(--primary)_55%,black)]'
        >
          <span className='heading text-primary-foreground/25 text-8xl leading-none'>
            {section.label.trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div aria-hidden className='absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent' />
      <div className='p-4'>
        <div className='heading text-[calc(1.25rem*var(--heading-scale))] leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]'>
          {section.label}
        </div>
        <div className='mt-0.5 text-sm text-white/80'>{count}</div>
      </div>
    </button>
  )
}
