import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Search, Sparkles, X } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { ItemImage } from './item-image'
import { itemPictureUrl } from './item-picture'
import { USUALS_CATEGORY, type Menu } from './use-menu'

function ItemTile({ item, onTap }: { item: CatalogItemDto; onTap: (item: CatalogItemDto) => void }) {
  const localized = useLocalized()
  const money = useMoney()
  return (
    <button
      type='button'
      disabled={item.isAvailable === false}
      onClick={() => onTap(item)}
      className='bg-card text-card-foreground flex flex-col overflow-hidden rounded-xl border text-start shadow-xs transition-colors active:scale-[0.98] disabled:opacity-40'
    >
      <div className='bg-muted flex aspect-[4/3] w-full items-center justify-center overflow-hidden md:aspect-square'>
        <ItemImage src={item.pictureUri ? itemPictureUrl(item.id) : null} className='h-full w-full' />
      </div>
      <div className='flex flex-col gap-0.5 p-2'>
        <span className='line-clamp-2 text-sm font-medium'>{localized(item.name)}</span>
        <span className='text-muted-foreground text-sm tabular-nums'>{money(item.effectivePrice ?? item.price)}</span>
      </div>
    </button>
  )
}

/**
 * The compact pad's tile, for a long menu: the name (two lines at most) and
 * the price, no picture. The line keeps the till's direction; the name is
 * isolated in it, so a Latin name in an Arabic till starts where an Arabic
 * one would.
 */
function CompactItemTile({ item, onTap }: { item: CatalogItemDto; onTap: (item: CatalogItemDto) => void }) {
  const localized = useLocalized()
  const money = useMoney()
  return (
    <button
      type='button'
      disabled={item.isAvailable === false}
      onClick={() => onTap(item)}
      className='bg-card text-card-foreground flex min-h-16 flex-col justify-between gap-1 overflow-hidden rounded-lg border px-2.5 py-2 text-start shadow-xs transition-colors active:scale-[0.98] disabled:opacity-40'
    >
      <span className='line-clamp-2 text-sm leading-snug font-medium'>
        <bdi>{localized(item.name)}</bdi>
      </span>
      <span className='text-muted-foreground text-sm tabular-nums'>{money(item.effectivePrice ?? item.price)}</span>
    </button>
  )
}

/** One category in the compact pad's side list: its name and how many items it holds, the one open filled in */
function RailCategory({
  label,
  count,
  active,
  icon,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  icon?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type='button'
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground',
      )}
    >
      {icon}
      <span className='line-clamp-2 min-w-0 flex-1'>
        <bdi>{label}</bdi>
      </span>
      <span className={cn('shrink-0 text-xs tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
        {count}
      </span>
    </button>
  )
}

/**
 * The menu side of the sale screen: the way back, the categories (chips over
 * the items, or a list down the side for a long menu on a tablet), the search
 * and the items. `foot` is the phone's bar to the order, under the menu.
 */
export function ItemPad({
  menu,
  compact,
  rail,
  foot,
}: {
  menu: Menu
  /** Text tiles for a long menu, the owner's choice; photo tiles otherwise */
  compact: boolean
  rail: boolean
  foot?: ReactNode
}) {
  const t = useT()
  const localized = useLocalized()
  const Tile = compact ? CompactItemTile : ItemTile

  // Compact packs the row by the menu's own width, not the screen's: six
  // across beside the order on a 1280 till, eight on a 1920 one
  const grid = (tiles: ReactNode) =>
    compact ? (
      <div className='@container'>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 @3xl:grid-cols-6 @5xl:grid-cols-7 @7xl:grid-cols-8'>
          {tiles}
        </div>
      </div>
    ) : (
      <div className='grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3'>{tiles}</div>
    )

  return (
    <div className='flex min-w-0 flex-1 flex-col'>
      <div className='flex items-center gap-2 border-b p-2'>
        <Button asChild variant='ghost' size='icon' className='size-12 shrink-0'>
          <Link to='/' aria-label={t('backToFloor')}>
            <ArrowLeft className='size-6 rtl:rotate-180' />
          </Link>
        </Button>
        {menu.searchOpen || rail ? (
          <div className='relative min-w-0 flex-1'>
            <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2' />
            <Input
              autoFocus={!rail}
              value={menu.searchTerm}
              onChange={(e) => menu.setSearchTerm(e.target.value)}
              placeholder={t('searchItems')}
              className='h-11 ps-9 text-base'
              autoComplete='off'
              enterKeyHint='search'
            />
          </div>
        ) : (
          /* A tablet sees every category: the chips wrap into rows rather
             than scrolling sideways behind a scrollbar. A phone has no room
             for rows of chips above the menu, so there they are one row that
             swipes, each chip snapping to the edge. */
          <div className='no-scrollbar flex min-w-0 flex-1 gap-2 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-1 max-md:overflow-x-auto max-md:px-1 md:flex-wrap'>
            {menu.hasUsuals && (
              <Button
                variant={menu.activeCategoryId === USUALS_CATEGORY ? 'default' : 'outline'}
                className='h-11 shrink-0 snap-start px-4 text-base'
                onClick={() => menu.pickCategory(USUALS_CATEGORY)}
              >
                <Sparkles className='size-4' />
                {t('usuals')}
              </Button>
            )}
            {menu.categories.map((category) => {
              const id = toNumber(category.id)
              return (
                <Button
                  key={id}
                  variant={id === menu.activeCategoryId ? 'default' : 'outline'}
                  className='h-11 shrink-0 snap-start px-4 text-base'
                  onClick={() => menu.pickCategory(id)}
                >
                  {localized(category.name)}
                </Button>
              )
            })}
          </div>
        )}
        {/* Search is the phone's shortcut past the one-row chips; a tablet has every category in view already */}
        <Button
          variant='ghost'
          size='icon'
          className='size-11 shrink-0 md:hidden'
          aria-label={menu.searchOpen ? t('clear') : t('searchItems')}
          onClick={() => (menu.searchOpen ? menu.closeSearch() : menu.openSearch())}
        >
          {menu.searchOpen ? <X className='size-5' /> : <Search className='size-5' />}
        </Button>
      </div>

      <div className='flex min-h-0 flex-1'>
        {rail && (
          <nav aria-label={t('categories')} className='flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-e p-2'>
            {menu.hasUsuals && (
              <RailCategory
                active={!menu.needle && menu.activeCategoryId === USUALS_CATEGORY}
                onClick={() => menu.pickCategory(USUALS_CATEGORY)}
                label={t('usuals')}
                count={menu.usualCount}
                icon={<Sparkles className='size-4 shrink-0' />}
              />
            )}
            {menu.categories.map((category) => {
              const id = toNumber(category.id)
              return (
                <RailCategory
                  key={id}
                  active={!menu.needle && id === menu.activeCategoryId}
                  onClick={() => menu.pickCategory(id)}
                  label={localized(category.name)}
                  count={menu.countIn.get(id) ?? 0}
                />
              )
            })}
          </nav>
        )}
        <div className='min-w-0 flex-1 overflow-y-auto p-3'>
          {menu.isLoading ? (
            grid(
              Array.from({ length: compact ? 24 : 8 }).map((_, i) =>
                compact ? (
                  /* Name and price lines, no picture: the compact tile's shape */
                  <div key={i} className='flex min-h-16 flex-col justify-between gap-1.5 rounded-lg border px-2.5 py-2 shadow-xs'>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-3 w-1/2' />
                  </div>
                ) : (
                  /* Picture, then name and price lines: the item tile's shape */
                  <div key={i} className='flex flex-col overflow-hidden rounded-xl border shadow-xs'>
                    <Skeleton className='aspect-[4/3] w-full rounded-none md:aspect-square' />
                    <div className='flex flex-col gap-1.5 p-2'>
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-3 w-1/2' />
                    </div>
                  </div>
                ),
              ),
            )
          ) : menu.visibleItems.length === 0 ? (
            <p className='text-muted-foreground py-16 text-center'>{menu.needle ? t('noItemsMatch') : t('noItemsInCategory')}</p>
          ) : (
            grid(menu.visibleItems.map((item) => <Tile key={String(item.id)} item={item} onTap={menu.tapItem} />))
          )}
        </div>
      </div>

      {foot}
    </div>
  )
}
