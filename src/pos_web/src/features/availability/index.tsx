import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import {
  listCategoriesOptions,
  listItemsOptions,
  listItemsQueryKey,
  toggleItemAvailabilityMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/**
 * Marking items sold out (and back) for this branch. Reads the same queries
 * as the sale pad — same keys — so a flip here greys the tile there at
 * once. The server ANDs the branch override with the global flag, so a row
 * shows the effective state: an item the back office pulled everywhere
 * stays off whatever the till says.
 */
export function Availability() {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [term, setTerm] = useState('')

  const { data: categories = [] } = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } })
  )
  const { data: items = [], isLoading } = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )

  const sortedCategories = categories
    .slice()
    .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))

  // A search spans every category; otherwise one category at a time, as on
  // the sale pad
  const search = term.trim().toLowerCase()
  const activeCategoryId = search
    ? null
    : activeCategory ??
      (sortedCategories.length > 0 ? toNumber(sortedCategories[0].id) : null)
  const visibleItems = items
    .filter((item) =>
      search
        ? `${item.name?.en ?? ''} ${item.name?.ar ?? ''}`
            .toLowerCase()
            .includes(search)
        : toNumber(item.catalogTypeId) === activeCategoryId
    )
    .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))

  // Availability flips optimistically (admin_web's menu pattern): update the
  // cached list first, roll back if the server rejects it. Always an
  // explicit body — the server-side "toggle" default could drift from what
  // the switch shows.
  const toggleAvailability = useMutation({
    ...toggleItemAvailabilityMutation(),
    onMutate: async (variables) => {
      const queryKey = listItemsQueryKey({
        query: { 'api-version': API_VERSION },
      })
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CatalogItemDto[]>(queryKey)
      queryClient.setQueryData<CatalogItemDto[]>(queryKey, (old) =>
        old?.map((item) =>
          Number(item.id) === variables.path.id
            ? { ...item, isAvailable: variables.body?.isAvailable ?? false }
            : item
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
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] }),
  })

  const setAvailable = (item: CatalogItemDto, isAvailable: boolean) =>
    toggleAvailability.mutate({
      path: { id: Number(item.id) },
      body: { isAvailable },
      query: { 'api-version': API_VERSION },
    })

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-4 p-4'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/' aria-label={t('backToFloor')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='text-xl font-bold'>{t('availability')}</h1>
      </div>

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

      {!search && (
        <div className='flex flex-wrap gap-2'>
          {sortedCategories.map((category) => {
            const id = toNumber(category.id)
            return (
              <Button
                key={id}
                variant={id === activeCategoryId ? 'default' : 'outline'}
                className='h-11 shrink-0 px-4 text-base'
                onClick={() => setActiveCategory(id)}
              >
                {localized(category.name)}
              </Button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <Skeleton className='h-48 rounded-xl' />
      ) : visibleItems.length === 0 ? (
        <p className='text-muted-foreground py-16 text-center'>
          {search ? t('noItemsMatch') : t('noItemsInCategory')}
        </p>
      ) : (
        <div className='bg-card divide-y overflow-hidden rounded-xl border'>
          {visibleItems.map((item) => {
            const available = item.isAvailable !== false
            const switchId = `availability-${String(item.id)}`
            // The whole row is the label, so a tap anywhere on it flips the
            // switch — no hunting for the control with a wet thumb
            return (
              <label
                key={String(item.id)}
                htmlFor={switchId}
                className='hover:bg-accent/50 flex min-h-16 w-full cursor-pointer items-center gap-3 px-3 py-2'
              >
                <span className='min-w-0 flex-1'>
                  <span
                    className={cn(
                      'block truncate text-base font-medium',
                      !available && 'text-muted-foreground line-through'
                    )}
                  >
                    {localized(item.name)}
                  </span>
                  <span className='text-muted-foreground block truncate text-sm tabular-nums'>
                    {money(item.effectivePrice ?? item.price)}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-sm font-medium',
                    available
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive'
                  )}
                >
                  {available ? t('available') : t('soldOut')}
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
  )
}
