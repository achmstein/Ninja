import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import {
  listCategoriesOptions,
  listItemsOptions,
  listItemsQueryKey,
  toggleItemAvailabilityMutation,
} from '@ninja/api/catalog/@tanstack/react-query.gen'
import type { CatalogItemDto } from '@ninja/api/catalog/types.gen'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

/** The list's first entry: everything that is off now, whatever its category */
const OFF = 'off' as const
type Picked = number | typeof OFF

/**
 * Marking items sold out (and back) for this branch. Two panels across the
 * whole screen, as the receipts are: the categories down the side, each with
 * how many of its items are off, and the picked category's items across the
 * rest, two to a row, a tap on one flipping it. The first entry gathers
 * everything that is off now, which is what the page is opened for most:
 * bringing back what ran out. A search spans every category. A phone has the
 * categories as one scrolling row over the items.
 *
 * Reads the same queries as the sale pad (same keys), so a flip here greys
 * the tile there at once. The server ANDs the branch override with the
 * global flag, so a row shows the effective state: an item the back office
 * pulled everywhere stays off whatever the till says. Inventory can pull an
 * item too, when a tracked stock item runs out; flipping it back on here
 * clears that.
 */
export function Availability() {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const [picked, setPicked] = useState<Picked | null>(null)
  const [term, setTerm] = useState('')

  const { data: categories = [] } = useQuery(listCategoriesOptions())
  const { data: items = [], isLoading } = useQuery(listItemsOptions())

  const sortedCategories = categories.slice().sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  const byOrder = (a: CatalogItemDto, b: CatalogItemDto) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
  const isOff = (item: CatalogItemDto) => item.isAvailable === false
  const offCount = items.filter(isOff).length
  const inCategory = (id: number) => items.filter((item) => toNumber(item.catalogTypeId) === id)

  // Opened on what is off, when anything is; otherwise on the first category
  const search = term.trim().toLowerCase()
  const active: Picked | null =
    picked ?? (offCount > 0 ? OFF : sortedCategories.length > 0 ? toNumber(sortedCategories[0].id) : OFF)
  const visibleItems = (
    search
      ? items.filter((item) => `${item.name?.en ?? ''} ${item.name?.ar ?? ''}`.toLowerCase().includes(search))
      : active === OFF
        ? items.filter(isOff)
        : inCategory(active)
  )
    .slice()
    .sort(byOrder)

  // Availability flips optimistically (admin_web's menu pattern): update the
  // cached list first, roll back if the server rejects it. Always an
  // explicit body: the server-side "toggle" default could drift from what
  // the switch shows.
  const toggleAvailability = useMutation({
    ...toggleItemAvailabilityMutation(),
    onMutate: async (variables) => {
      const queryKey = listItemsQueryKey()
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CatalogItemDto[]>(queryKey)
      queryClient.setQueryData<CatalogItemDto[]>(queryKey, (old) =>
        old?.map((item) =>
          Number(item.id) === variables.path.id ? { ...item, isAvailable: variables.body?.isAvailable ?? false } : item
        )
      )
      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
      toast.error(t('failedToUpdateAvailability'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] }),
  })

  const setAvailable = (item: CatalogItemDto, isAvailable: boolean) =>
    toggleAvailability.mutate({
      path: { id: Number(item.id) },
      body: { isAvailable },
    })

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  const pick = (to: Picked) => {
    setPicked(to)
    setTerm('')
  }

  // The list's entries: what is off first, then the categories in the menu's order
  const entries: Array<{ key: Picked; name: string; off: number; all: number }> = [
    { key: OFF, name: t('availabilityOffNow'), off: offCount, all: offCount },
    ...sortedCategories.map((category) => {
      const id = toNumber(category.id)
      const own = inCategory(id)
      return { key: id as Picked, name: localized(category.name), off: own.filter(isOff).length, all: own.length }
    }),
  ]
  const activeName = entries.find((entry) => entry.key === active)?.name ?? ''

  const back = (
    <Button asChild variant='ghost' size='icon' className='size-12 shrink-0'>
      <Link to='/' aria-label={t('backToFloor')}>
        <BackIcon className='size-6' />
      </Link>
    </Button>
  )
  const find = (
    <div className='relative'>
      <Search className='text-muted-foreground absolute start-3 top-1/2 size-5 -translate-y-1/2' />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t('searchItems')}
        className='h-12 ps-10 text-base'
        autoComplete='off'
      />
    </div>
  )
  // How many are off, as a red count; a category with none off says how many it holds, quietly
  const count = (entry: (typeof entries)[number], lit = false) =>
    entry.off > 0 ? (
      <span
        className={cn(
          'type-caption shrink-0 rounded-full px-2.5 font-semibold tabular-nums',
          lit ? 'bg-primary-foreground/20' : 'bg-destructive/10 text-destructive'
        )}
      >
        {entry.off}
      </span>
    ) : entry.key === OFF ? null : (
      <span className={cn('type-caption shrink-0 px-2.5 tabular-nums', !lit && 'text-muted-foreground')}>
        {entry.all}
      </span>
    )

  return (
    <div className='flex max-md:flex-col md:h-[calc(100svh-4rem)]'>
      {/* The categories down the side: built like the receipts list beside its receipt */}
      <div className='flex min-w-0 flex-col max-md:hidden md:w-[clamp(18rem,28vw,24rem)] md:shrink-0 md:border-e'>
        <div className='flex shrink-0 items-center gap-2 border-b px-3 py-2'>
          {back}
          <h1 className='type-title'>{t('availability')}</h1>
        </div>
        <div className='shrink-0 border-b p-2'>{find}</div>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {entries.map((entry) => {
            const on = !search && entry.key === active
            return (
              <button
                key={String(entry.key)}
                type='button'
                onClick={() => pick(entry.key)}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'hover:bg-accent/50 flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 text-start',
                  on && 'bg-accent hover:bg-accent border-s-primary border-s-[3px] ps-[calc(1rem-3px)]'
                )}
              >
                <span
                  className={cn(
                    'type-heading min-w-0 flex-1 break-words',
                    entry.key === OFF && entry.off > 0 && 'text-destructive'
                  )}
                >
                  {entry.name}
                </span>
                {count(entry)}
              </button>
            )
          })}
        </div>
      </div>

      <section className='flex min-w-0 flex-1 flex-col'>
        <div className='flex min-h-16 shrink-0 items-center gap-2 border-b px-3 py-2 md:px-4'>
          <span className='md:hidden'>{back}</span>
          <h2 className='type-title min-w-0 flex-1 break-words'>
            <span className='md:hidden'>{t('availability')}</span>
            <span className='max-md:hidden'>{search ? t('searchResults') : activeName}</span>
          </h2>
          <span className='text-muted-foreground type-detail shrink-0 tabular-nums'>
            {offCount > 0 ? t('availabilityOffCount', { count: offCount }) : t('availabilityAllOn')}
          </span>
        </div>

        {/* A phone: the search, then the categories as one scrolling row */}
        <div className='shrink-0 border-b p-2 md:hidden'>{find}</div>
        {!search && (
          <div className='no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b px-3 py-2 md:hidden'>
            {entries.map((entry) => {
              const on = entry.key === active
              return (
                <Button
                  key={String(entry.key)}
                  variant={on ? 'default' : 'outline'}
                  className='h-11 shrink-0 gap-2 px-4 text-base'
                  onClick={() => pick(entry.key)}
                >
                  {entry.name}
                  {entry.off > 0 && count(entry, on)}
                </Button>
              )
            })}
          </div>
        )}

        <div className='min-h-0 flex-1 md:overflow-y-auto'>
          {isLoading ? (
            <div className='grid md:grid-cols-2'>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className='flex min-h-16 items-center gap-3 border-b px-4 py-2 md:px-5 md:odd:border-e'>
                  <Skeleton className='h-4 flex-1' />
                  <Skeleton className='h-6 w-11 shrink-0 rounded-full' />
                </div>
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <p className='text-muted-foreground px-4 py-16 text-center'>
              {search ? t('noItemsMatch') : active === OFF ? t('availabilityAllOn') : t('noItemsInCategory')}
            </p>
          ) : (
            <div className='grid content-start md:grid-cols-2'>
              {visibleItems.map((item) => {
                const available = !isOff(item)
                const switchId = `availability-${String(item.id)}`
                // The whole row is the label, so a tap anywhere on it flips the
                // switch: no hunting for the control with a wet thumb
                return (
                  <label
                    key={String(item.id)}
                    htmlFor={switchId}
                    className='hover:bg-accent/50 flex min-h-16 cursor-pointer items-center gap-3 border-b px-4 py-2 md:px-5 md:odd:border-e'
                  >
                    <span className='min-w-0 flex-1'>
                      {/* The name whole: it wraps, it is never cut */}
                      <span
                        className={cn(
                          'type-heading block break-words',
                          !available && 'text-muted-foreground line-through'
                        )}
                      >
                        {localized(item.name)}
                      </span>
                      {/* Off is said under the name, and why when inventory pulled it and not a person:
                          flipping the switch on overrides the stock-out */}
                      {!available && (
                        <span className='text-destructive type-detail block'>
                          {item.isOutOfStock ? t('outOfStock') : t('soldOut')}
                        </span>
                      )}
                    </span>
                    <Switch
                      id={switchId}
                      checked={available}
                      onCheckedChange={(checked) => setAvailable(item, checked)}
                      aria-label={localized(item.name)}
                    />
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
