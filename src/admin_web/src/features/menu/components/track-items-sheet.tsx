import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Sparkles } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { type CatalogItemDto } from '@/api/catalog'
import { type RecipesProposal } from '@/api/inventory'
import {
  proposeRecipesMutation,
  trackByUnitMutation,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { assistErrorMessage, useAssistStore } from '@/features/assist/errors'
import { stockItemsQueryOptions } from '@/features/inventory/queries'
import { PROPOSE_BATCH, toMenuItemToTrack } from '../track-items'
import { RecipeReviewSheet } from './recipe-review-sheet'

type TrackItemsSheetProps = {
  /** Menu items the storeroom does not track yet, in menu order */
  untracked: CatalogItemDto[]
  onOpenChange: (open: boolean) => void
}

/**
 * Start tracking many menu items at once. Pick them, then either sell
 * them as units — each becomes a stock item of its own, no assistant
 * needed — or ask the assistant to propose a recipe for each, which opens
 * the review sheet. A long pick goes up in batches.
 */
export function TrackItemsSheet({
  untracked,
  onOpenChange,
}: TrackItemsSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const assistAvailable = useAssistStore((s) => !s.unavailable)
  const shelf = useQuery(stockItemsQueryOptions())

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState('')
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [proposals, setProposals] = useState<RecipesProposal[] | null>(null)

  const trackByUnit = useMutation(trackByUnitMutation())
  const propose = useMutation(proposeRecipesMutation())

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const shown = needle
      ? untracked.filter((item) =>
          `${item.name?.en ?? ''} ${item.name?.ar ?? ''}`
            .toLowerCase()
            .includes(needle)
        )
      : untracked
    const byCategory = new Map<string, CatalogItemDto[]>()
    for (const item of shown) {
      const key = localized(item.catalogTypeName) || '—'
      byCategory.set(key, [...(byCategory.get(key) ?? []), item])
    }
    return [...byCategory.entries()]
  }, [untracked, filter, localized])

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const toggleMany = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const picked = untracked.filter((item) => selected.has(toNumber(item.id)))
  const busy = progress !== null

  const finish = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRecipes' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRecipeCosts' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStockItems' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStockLevels' }] })
  }

  // Each picked item becomes a pcs stock item named after it, one per sale
  const sellAsUnits = async () => {
    if (picked.length === 0) return
    let done = 0
    setProgress({ done, total: picked.length })
    try {
      for (const item of picked) {
        await trackByUnit.mutateAsync({
          body: {
            catalogItemId: toNumber(item.id),
            name: { en: item.name?.en ?? '', ar: item.name?.ar ?? null },
          },
          headers: { 'x-requestid': uuidv4() },
          query: { 'api-version': API_VERSION },
        })
        setProgress({ done: ++done, total: picked.length })
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(toNumber(item.id))
          return next
        })
      }
      toast.success(t('trackedAsUnits', { count: done }))
      finish()
      onOpenChange(false)
    } catch {
      toast.error(t('failedToTrack'))
      finish()
    } finally {
      setProgress(null)
    }
  }

  // The assistant proposes a recipe per item, in batches the endpoint accepts
  const proposeRecipes = async () => {
    if (picked.length === 0) return
    const batches: CatalogItemDto[][] = []
    for (let i = 0; i < picked.length; i += PROPOSE_BATCH) {
      batches.push(picked.slice(i, i + PROPOSE_BATCH))
    }
    setProgress({ done: 0, total: batches.length })
    const answers: RecipesProposal[] = []
    try {
      for (const [index, batch] of batches.entries()) {
        answers.push(
          await propose.mutateAsync({
            body: { items: batch.map(toMenuItemToTrack) },
            query: { 'api-version': API_VERSION },
          })
        )
        setProgress({ done: index + 1, total: batches.length })
      }
      setProposals(answers)
    } catch (error) {
      toast.error(assistErrorMessage(error))
      // What came back before the failure is still worth reviewing
      if (answers.length > 0) setProposals(answers)
    } finally {
      setProgress(null)
    }
  }

  if (proposals) {
    return (
      <RecipeReviewSheet
        proposals={proposals}
        items={picked}
        shelf={shelf.data ?? []}
        onOpenChange={(open) => {
          if (!open) {
            finish()
            onOpenChange(false)
          }
        }}
        onBack={() => setProposals(null)}
      />
    )
  }

  return (
    <Sheet open onOpenChange={(open) => !busy && onOpenChange(open)}>
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>{t('trackItems')}</SheetTitle>
          <SheetDescription>{t('trackItemsDescription')}</SheetDescription>
        </SheetHeader>

        <div className='flex items-center gap-2 border-b px-4 py-2'>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchItemsPlaceholder')}
            className='h-9'
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() =>
              toggleMany(
                groups.flatMap(([, items]) => items.map((i) => toNumber(i.id))),
                true
              )
            }
          >
            {t('selectAll')}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={selected.size === 0}
            onClick={() => setSelected(new Set())}
          >
            {t('clearSelection')}
          </Button>
        </div>

        <div className='flex-1 overflow-y-auto px-4 py-2'>
          {untracked.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('everythingTracked')}
            </p>
          ) : groups.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('noItemsFound')}
            </p>
          ) : (
            groups.map(([category, items]) => {
              const ids = items.map((i) => toNumber(i.id))
              const all = ids.every((id) => selected.has(id))
              return (
                <div key={category} className='py-2'>
                  <label className='flex cursor-pointer items-center gap-2 py-1 text-sm font-medium'>
                    <Checkbox
                      checked={
                        all
                          ? true
                          : ids.some((id) => selected.has(id))
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(on) => toggleMany(ids, on === true)}
                    />
                    {category}
                    <span className='text-muted-foreground text-xs font-normal'>
                      {items.length}
                    </span>
                  </label>
                  <ul className='ms-6 divide-y'>
                    {items.map((item) => {
                      const id = toNumber(item.id)
                      return (
                        <li key={id}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-2 py-1.5 text-sm',
                              !item.isAvailable && 'text-muted-foreground'
                            )}
                          >
                            <Checkbox
                              checked={selected.has(id)}
                              onCheckedChange={(on) => toggle(id, on === true)}
                            />
                            <span className='min-w-0 flex-1 truncate'>
                              {localized(item.name) || '—'}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        <SheetFooter className='border-t'>
          <div className='flex w-full flex-wrap items-center justify-between gap-2'>
            <span className='text-muted-foreground text-sm tabular-nums'>
              {progress
                ? t('trackingProgress', {
                    done: progress.done,
                    total: progress.total,
                  })
                : t('itemsPicked', { count: picked.length })}
            </span>
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                disabled={picked.length === 0 || busy}
                onClick={sellAsUnits}
                title={t('sellAsUnitsHint')}
              >
                {busy && trackByUnit.isPending ? (
                  <Spinner className='me-2' />
                ) : (
                  <Package className='me-2 h-4 w-4' />
                )}
                {t('sellAsUnits')}
              </Button>
              {assistAvailable && (
                <Button
                  type='button'
                  disabled={picked.length === 0 || busy}
                  onClick={proposeRecipes}
                  title={t('proposeRecipesHint')}
                >
                  {busy && propose.isPending ? (
                    <Spinner className='me-2' />
                  ) : (
                    <Sparkles className='me-2 h-4 w-4' />
                  )}
                  {t('proposeRecipes')}
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
