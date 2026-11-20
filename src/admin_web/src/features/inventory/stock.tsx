import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { isOwner } from '@/config/oidc-config'
import {
  ArrowLeftRight,
  ArrowUpDown,
  Boxes,
  ClipboardCheck,
  MoreHorizontal,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { type StockLevelView } from '@/api/inventory'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { DaysLeft } from './components/days-left'
import { ReceiveDialog } from './components/receive-dialog'
import { StockItemDialog } from './components/stock-item-dialog'
import { StockItemPanel } from './components/stock-item-panel'
import { StockStats } from './components/stock-stats'
import { TransferDialog } from './components/transfer-dialog'
import { formatQuantity, packsOf, unitLabel } from './format'
import { stockLevelsQueryOptions } from './queries'
import { daysLeft, sortLevels, stockSorts, type StockSort } from './stock-sort'
import { StockTabs } from './stock-tabs'
import { useInventoryActions } from './use-inventory-actions'

const route = getRouteApi('/_authenticated/inventory/')

const NO_LEVELS: StockLevelView[] = []

const sortLabels: Record<StockSort, TranslationKey> = {
  low: 'stockSortLow',
  daysLeft: 'stockSortDaysLeft',
  value: 'stockSortValue',
  name: 'name',
}

// The list's columns where there is room for them: the item, then what is on
// hand, how long it lasts, where its warning line sits, its cost and its worth
const COLUMNS =
  'md:grid md:grid-cols-[minmax(0,1fr)_8rem_7rem_8rem_7rem_7rem] md:gap-4'

/**
 * The branch's stock as one list across the page: every item with what is
 * on hand, how many days it lasts, its reorder level, cost and worth, low
 * ones first unless sorted otherwise. An item opens as a page of its own.
 * Counting turns the list into a checklist you walk with the tablet;
 * receiving keeps the invoice dialog.
 */
export function Stock() {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const owner = isOwner(auth.user)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { branches } = useAllowedBranches()
  const { rebuildLevels, isPending } = useInventoryActions()

  const [receiveFor, setReceiveFor] = useState<number | null | undefined>(
    undefined
  )
  const [transferOpen, setTransferOpen] = useState(false)
  const [newItemOpen, setNewItemOpen] = useState(false)
  const [rebuildOpen, setRebuildOpen] = useState(false)
  const [counting, setCounting] = useState(false)

  // One fetch for everything; retired items are hidden client-side unless asked for
  const levelsQuery = useQuery(
    stockLevelsQueryOptions({ includeRetired: true })
  )
  const levels = levelsQuery.data ?? NO_LEVELS
  const active = useMemo(() => levels.filter((l) => l.isActive), [levels])

  const lowCount = useMemo(() => active.filter((l) => l.isLow).length, [active])

  const sort = search.sort ?? 'low'
  const visible = useMemo(() => {
    const q = (search.q ?? '').trim().toLowerCase()
    return sortLevels(
      levels
        .filter((l) => l.isActive || search.retired)
        .filter((l) => !search.low || l.isLow)
        .filter(
          (l) =>
            !q ||
            (l.name?.en ?? '').toLowerCase().includes(q) ||
            (l.name?.ar ?? '').toLowerCase().includes(q)
        ),
      sort,
      (l) => localized(l.name)
    )
  }, [levels, search.q, search.low, search.retired, sort, localized])

  const selected = levels.find((l) => toNumber(l.stockItemId) === search.item)

  const select = (item: number | undefined) =>
    navigate({ search: (prev) => ({ ...prev, item }) })

  const setQuery = (q: string) =>
    navigate({
      search: (prev) => ({ ...prev, q: q || undefined }),
      replace: true,
    })

  return (
    <>
      <Main fixed>
        {selected ? (
          // One item is the whole page
          <StockItemPanel
            key={String(selected.stockItemId)}
            level={selected}
            onBack={() => select(undefined)}
            onReceive={() => setReceiveFor(toNumber(selected.stockItemId))}
          />
        ) : search.item != null && levelsQuery.isLoading ? (
          <div className='space-y-3'>
            <Skeleton className='h-8 w-56' />
            <Skeleton className='h-24' />
            <Skeleton className='h-48' />
          </div>
        ) : (
          <>
            <PageHeader
              title={t('inventoryStock')}
              actions={
                <>
                  {/* One Receive for the page; the rest is behind More */}
                  <Button
                    size='sm'
                    onClick={() => setReceiveFor(null)}
                    disabled={counting}
                  >
                    <PackagePlus />
                    {t('receiveStock')}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='outline'
                        size='icon'
                        className='size-9'
                        aria-label={t('moreActions')}
                      >
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      {/* A count has its own Cancel and Save on the page */}
                      <DropdownMenuItem
                        disabled={counting}
                        onClick={() => setCounting(true)}
                      >
                        <ClipboardCheck className='h-4 w-4' />
                        {t('countStock')}
                      </DropdownMenuItem>
                      {branches.length > 1 && (
                        <DropdownMenuItem
                          disabled={counting}
                          onClick={() => setTransferOpen(true)}
                        >
                          <ArrowLeftRight className='h-4 w-4' />
                          {t('transferStock')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setNewItemOpen(true)}>
                        <Plus className='h-4 w-4' />
                        {t('newStockItem')}
                      </DropdownMenuItem>
                      <DropdownMenuCheckboxItem
                        checked={!!search.retired}
                        onCheckedChange={(checked) =>
                          navigate({
                            search: (prev) => ({
                              ...prev,
                              retired: checked ? true : undefined,
                            }),
                          })
                        }
                      >
                        {t('showRetired')}
                      </DropdownMenuCheckboxItem>
                      {owner && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setRebuildOpen(true)}
                          >
                            <RefreshCw className='h-4 w-4' />
                            {t('rebuildLevels')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            >
              <StockTabs value='stock' />
              <StockStats levels={active} />
            </PageHeader>

            {counting ? (
              <CountMode
                levels={visible.filter((l) => l.isActive)}
                total={active.length}
                query={search.q ?? ''}
                onQueryChange={setQuery}
                onDone={() => setCounting(false)}
              />
            ) : (
              <>
                <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
                  <div className='relative w-full sm:w-72'>
                    <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
                    <Input
                      value={search.q ?? ''}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('searchStockPlaceholder')}
                      className='h-9 ps-8'
                    />
                  </div>
                  <div className='flex flex-1'>
                    <Button
                      variant={search.low ? 'secondary' : 'ghost'}
                      size='sm'
                      aria-pressed={!!search.low}
                      onClick={() =>
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            low: search.low ? undefined : true,
                          }),
                        })
                      }
                    >
                      <TriangleAlert
                        className={cn(lowCount > 0 && 'text-destructive')}
                      />
                      {t('lowItems')}
                      <span className='text-muted-foreground tabular-nums'>
                        {lowCount}
                      </span>
                    </Button>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='outline' size='sm'>
                        <ArrowUpDown />
                        {t(sortLabels[sort])}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuRadioGroup
                        value={sort}
                        onValueChange={(value) =>
                          navigate({
                            search: (prev) => ({
                              ...prev,
                              sort:
                                value === 'low'
                                  ? undefined
                                  : (value as StockSort),
                            }),
                          })
                        }
                      >
                        {stockSorts.map((s) => (
                          <DropdownMenuRadioItem key={s} value={s}>
                            {t(sortLabels[s])}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <section className='bg-card flex min-h-0 flex-1 flex-col rounded-lg border'>
                  {/* The column names, where there is room for columns */}
                  <div
                    className={cn(
                      'text-muted-foreground hidden flex-none items-center border-b px-4 py-2.5 text-xs font-medium',
                      COLUMNS
                    )}
                  >
                    <span>{t('stockItem')}</span>
                    <span className='text-end'>{t('onHand')}</span>
                    <span className='text-end'>{t('daysLeft')}</span>
                    <span className='text-end'>{t('reorderAtColumn')}</span>
                    <span className='text-end'>{t('avgCost')}</span>
                    <span className='text-end'>{t('valueColumn')}</span>
                  </div>
                  {levelsQuery.isError ? (
                    <ErrorState
                      error={levelsQuery.error}
                      onRetry={() => levelsQuery.refetch()}
                    />
                  ) : levelsQuery.isLoading ? (
                    <div className='space-y-2 p-3'>
                      {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className='h-12 rounded-md' />
                      ))}
                    </div>
                  ) : visible.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Boxes}
                      title={
                        levels.length === 0
                          ? t('noStockLevels')
                          : search.low && !search.q
                            ? t('nothingLow')
                            : t('noResults')
                      }
                      action={
                        levels.length === 0 ? (
                          <Button
                            variant='outline'
                            onClick={() => setNewItemOpen(true)}
                          >
                            <Plus />
                            {t('addStockItem')}
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <ScrollArea className='min-h-0 flex-1'>
                      {visible.map((level) => (
                        <StockRow
                          key={String(level.stockItemId)}
                          level={level}
                          onOpen={select}
                        />
                      ))}
                    </ScrollArea>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </Main>

      <ReceiveDialog
        open={receiveFor !== undefined}
        onOpenChange={(open) => {
          if (!open) setReceiveFor(undefined)
        }}
        stockItemId={receiveFor}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
      <StockItemDialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        item={null}
      />

      <ConfirmDialog
        open={rebuildOpen}
        onOpenChange={setRebuildOpen}
        title={t('rebuildLevelsQuestion')}
        desc={t('rebuildLevelsDescription')}
        confirmText={t('rebuildLevels')}
        isLoading={isPending}
        handleConfirm={async () => {
          try {
            await rebuildLevels()
            setRebuildOpen(false)
          } catch {
            // toasted by useInventoryActions
          }
        }}
      />
    </>
  )
}

/**
 * One item of the list. Wide: a row of columns. On a phone: the name with
 * how long it lasts and its reorder level under it, what is on hand at the end.
 */
function StockRow({
  level,
  onOpen,
}: {
  level: StockLevelView
  onOpen: (id: number) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const packs = packsOf(level.onHand, level.packSize)
  const days = level.isActive ? daysLeft(level) : null
  const reorderAt =
    level.reorderLevel != null
      ? formatQuantity(level.reorderLevel, level.unit, t)
      : null
  const nothing = <span className='text-muted-foreground/60'>–</span>

  return (
    <button
      type='button'
      className={cn(
        'hover:bg-accent/60 flex w-full items-center gap-3 border-b px-4 py-2.5 text-start text-sm last:border-b-0',
        COLUMNS,
        !level.isActive && 'opacity-60'
      )}
      onClick={() => onOpen(toNumber(level.stockItemId))}
    >
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium'>{localized(level.name)}</div>
        {!level.isActive ? (
          <div className='text-muted-foreground text-xs'>{t('retired')}</div>
        ) : (
          <div className='text-muted-foreground truncate text-xs md:hidden'>
            {days !== null && (
              <>
                <DaysLeft days={days} left />
                {' · '}
              </>
            )}
            {reorderAt
              ? t('reorderAt', { level: reorderAt })
              : t('noReorderLevel')}
          </div>
        )}
        {/* How much is left against the reorder level, at a glance:
            full at three times it, red at or under it, amber within twice it */}
        {level.isActive &&
          level.reorderLevel != null &&
          toNumber(level.reorderLevel) > 0 && (
            <StockGauge
              onHand={toNumber(level.onHand)}
              reorderAt={toNumber(level.reorderLevel)}
            />
          )}
      </div>
      <div className='shrink-0 text-end'>
        <div
          className={cn(
            'font-medium tabular-nums',
            level.isLow && 'text-destructive'
          )}
        >
          {formatQuantity(level.onHand, level.unit, t)}
        </div>
        {packs !== null && (
          <div className='text-muted-foreground text-xs tabular-nums'>
            {t('approxPacks', {
              packs,
              packName: localized(level.packName) || t('pack'),
            })}
          </div>
        )}
      </div>
      <span className='hidden truncate text-end md:block'>
        {days !== null ? <DaysLeft days={days} /> : nothing}
      </span>
      <span className='text-muted-foreground hidden truncate text-end tabular-nums md:block'>
        {reorderAt ?? nothing}
      </span>
      <span className='hidden truncate text-end tabular-nums md:block'>
        {toNumber(level.avgUnitCost) > 0 ? (
          <>
            {formatEgp(level.avgUnitCost)}
            <span className='text-muted-foreground text-xs'>
              {' / '}
              {unitLabel(level.unit, t)}
            </span>
          </>
        ) : (
          nothing
        )}
      </span>
      <span className='hidden truncate text-end tabular-nums md:block'>
        {toNumber(level.value) > 0 ? formatEgp(level.value) : nothing}
      </span>
    </button>
  )
}

type CountModeProps = {
  levels: StockLevelView[]
  total: number
  query: string
  onQueryChange: (q: string) => void
  onDone: () => void
}

/**
 * The list as a checklist: expected on the start side, a box to type what
 * is actually there on the end side. Blank rows are skipped, so a partial
 * count (just the fridge) posts fine.
 */
function CountMode({
  levels,
  total,
  query,
  onQueryChange,
  onDone,
}: CountModeProps) {
  const t = useT()
  const localized = useLocalized()
  const { postCount, isPending } = useInventoryActions()
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  const done = Object.values(counted).filter((v) => v.trim() !== '').length

  const save = async () => {
    const lines = Object.entries(counted)
      .filter(([, raw]) => raw.trim() !== '')
      .map(([id, raw]) => ({
        stockItemId: Number(id),
        counted: parseFloat(raw),
      }))
      .filter((line) => line.counted >= 0)
    if (lines.length === 0) {
      toast.error(t('countNeedsLine'))
      return
    }
    try {
      await postCount({ note: note.trim() || null, lines })
      onDone()
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-48 flex-1'>
          <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('searchStockPlaceholder')}
            className='h-9 ps-8'
          />
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('countNotePlaceholder')}
          className='h-9 min-w-48 flex-1'
          aria-label={t('notesOptional')}
        />
        <span className='text-muted-foreground text-sm tabular-nums'>
          {t('countingProgress', { done, total })}
        </span>
        <Button variant='ghost' size='sm' onClick={onDone} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button size='sm' onClick={save} disabled={isPending || done === 0}>
          {isPending && <Spinner />}
          {t('saveCount')}
        </Button>
      </div>

      <ScrollArea className='-mx-3 h-full' viewportClassName='p-3 pb-10'>
        <ul className='divide-y'>
          {levels.map((level) => {
            const id = String(level.stockItemId)
            const value = counted[id] ?? ''
            const expected = toNumber(level.onHand)
            const typed = value.trim() === '' ? null : parseFloat(value)
            const off = typed !== null && !isNaN(typed) && typed !== expected
            return (
              <li key={id} className='flex items-center gap-3 py-2'>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {localized(level.name)}
                  </div>
                  <div className='text-muted-foreground text-xs tabular-nums'>
                    {t('expected')}:{' '}
                    {formatQuantity(level.onHand, level.unit, t)}
                  </div>
                </div>
                {off && (
                  <span
                    className={cn(
                      'text-xs font-medium tabular-nums',
                      typed! < expected ? 'text-destructive' : 'text-success'
                    )}
                  >
                    {typed! > expected ? '+' : '−'}
                    {formatQuantity(Math.abs(typed! - expected), level.unit, t)}
                  </span>
                )}
                <Input
                  type='number'
                  min='0'
                  step='any'
                  inputMode='decimal'
                  className='h-9 w-32 text-end tabular-nums'
                  placeholder={unitLabel(level.unit, t)}
                  aria-label={`${t('counted')} ${localized(level.name)}`}
                  value={value}
                  onChange={(e) =>
                    setCounted((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                />
              </li>
            )
          })}
        </ul>
        {levels.length === 0 && (
          <EmptyState compact icon={Boxes} title={t('noResults')} />
        )}
      </ScrollArea>
    </div>
  )
}

function StockGauge({
  onHand,
  reorderAt,
}: {
  onHand: number
  reorderAt: number
}) {
  const share = Math.max(0, Math.min(1, onHand / (reorderAt * 3)))
  const tone =
    onHand <= reorderAt
      ? 'bg-destructive'
      : onHand <= reorderAt * 2
        ? 'bg-warning'
        : 'bg-success'
  return (
    <div className='bg-muted mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full'>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          tone
        )}
        style={{ width: `${Math.max(share * 100, onHand > 0 ? 4 : 0)}%` }}
      />
    </div>
  )
}
