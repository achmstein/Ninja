import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { isOwner } from '@/config/oidc-config'
import {
  ArrowLeftRight,
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
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ReceiveDialog } from './components/receive-dialog'
import { StockItemDialog } from './components/stock-item-dialog'
import { StockItemPanel } from './components/stock-item-panel'
import { StockStats } from './components/stock-stats'
import { TransferDialog } from './components/transfer-dialog'
import { formatQuantity, packsOf, unitLabel } from './format'
import { stockLevelsQueryOptions } from './queries'
import { useInventoryActions } from './use-inventory-actions'

const route = getRouteApi('/_authenticated/inventory/')

const NO_LEVELS: StockLevelView[] = []

/**
 * The branch's stock as a master-detail split: every item on the start
 * side (low ones first), the selected item's level, quick fixes and
 * history on the end side. Counting turns the list into a checklist you
 * walk with the tablet; receiving keeps the invoice dialog.
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

  const visible = useMemo(() => {
    const q = (search.q ?? '').trim().toLowerCase()
    return levels
      .filter((l) => l.isActive || search.retired)
      .filter((l) => !search.low || l.isLow)
      .filter(
        (l) =>
          !q ||
          (l.name?.en ?? '').toLowerCase().includes(q) ||
          (l.name?.ar ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        if (a.isLow !== b.isLow) return a.isLow ? -1 : 1
        return localized(a.name).localeCompare(localized(b.name), undefined, {
          numeric: true,
        })
      })
  }, [levels, search.q, search.low, search.retired, localized])

  const selected = levels.find((l) => toNumber(l.stockItemId) === search.item)

  const select = (item: number | undefined) =>
    navigate({ search: (prev) => ({ ...prev, item }) })

  return (
    <>
      <Main fixed>
        <PageHeader
          title={t('inventoryStock')}
          actions={
            <>
              {branches.length > 1 && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setTransferOpen(true)}
                  disabled={counting}
                >
                  <ArrowLeftRight className='me-2 h-4 w-4' />
                  {t('transferStock')}
                </Button>
              )}
              <Button
                size='sm'
                variant={counting ? 'secondary' : 'outline'}
                onClick={() => setCounting((c) => !c)}
                aria-pressed={counting}
              >
                <ClipboardCheck className='me-2 h-4 w-4' />
                {t('countStock')}
              </Button>
              {/* One Receive for the page; starts on the open item when there is one */}
              <Button
                size='sm'
                onClick={() =>
                  setReceiveFor(
                    selected ? toNumber(selected.stockItemId) : null
                  )
                }
                disabled={counting}
              >
                <PackagePlus className='me-2 h-4 w-4' />
                {t('receiveStock')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='outline'
                    size='icon'
                    aria-label={t('moreActions')}
                  >
                    <MoreHorizontal className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
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
                      <DropdownMenuItem onClick={() => setRebuildOpen(true)}>
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
          <StockStats levels={active} />
        </PageHeader>

        <section className='relative flex min-h-0 flex-1 gap-6'>
          {/* Master: the items */}
          <div
            className={cn(
              'flex w-full flex-col gap-2',
              counting ? 'sm:w-full' : 'sm:w-64 lg:w-80 2xl:w-96'
            )}
          >
            {counting ? (
              <CountMode
                levels={visible.filter((l) => l.isActive)}
                total={active.length}
                query={search.q ?? ''}
                onQueryChange={(q) =>
                  navigate({
                    search: (prev) => ({ ...prev, q: q || undefined }),
                  })
                }
                onDone={() => setCounting(false)}
              />
            ) : (
              <>
                <div className='flex items-center gap-2'>
                  <div className='relative flex-1'>
                    <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
                    <Input
                      value={search.q ?? ''}
                      onChange={(e) =>
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            q: e.target.value || undefined,
                          }),
                        })
                      }
                      placeholder={t('searchStockPlaceholder')}
                      className='h-9 ps-8'
                    />
                  </div>
                  <Button
                    variant={search.low ? 'secondary' : 'outline'}
                    size='sm'
                    className='h-9'
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
                      className={cn(
                        'me-1.5 h-4 w-4',
                        lowCount > 0 && 'text-destructive'
                      )}
                    />
                    {t('lowItems')}
                    <span className='text-muted-foreground ms-1.5 tabular-nums'>
                      {lowCount}
                    </span>
                  </Button>
                </div>

                {levelsQuery.isError ? (
                  <ErrorState
                    error={levelsQuery.error}
                    onRetry={() => levelsQuery.refetch()}
                  />
                ) : (
                  <ScrollArea className='-mx-3 h-full p-3'>
                    {levelsQuery.isLoading ? (
                      [...Array(8)].map((_, i) => (
                        <Skeleton key={i} className='mb-2 h-14 rounded-md' />
                      ))
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
                              <Plus className='me-2 h-4 w-4' />
                              {t('addStockItem')}
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      visible.map((level) => {
                        const id = toNumber(level.stockItemId)
                        const packs = packsOf(level.onHand, level.packSize)
                        const isSelected = id === search.item
                        return (
                          <button
                            key={id}
                            type='button'
                            className={cn(
                              'hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start text-sm',
                              isSelected && 'sm:bg-muted',
                              !level.isActive && 'opacity-60'
                            )}
                            onClick={() => select(id)}
                          >
                            <div className='min-w-0 flex-1'>
                              <div className='truncate font-medium'>
                                {localized(level.name)}
                              </div>
                              <div className='text-muted-foreground truncate text-xs'>
                                {!level.isActive
                                  ? t('retired')
                                  : level.reorderLevel != null
                                    ? t('reorderAt', {
                                        level: formatQuantity(
                                          level.reorderLevel,
                                          level.unit,
                                          t
                                        ),
                                      })
                                    : t('noReorderLevel')}
                              </div>
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
                                    packName: level.packName || t('pack'),
                                  })}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </ScrollArea>
                )}
              </>
            )}
          </div>

          {/* Detail */}
          {!counting &&
            (selected ? (
              <div className='bg-background absolute inset-0 z-50 flex w-full flex-1 flex-col border sm:static sm:z-auto sm:rounded-lg'>
                <StockItemPanel
                  key={String(selected.stockItemId)}
                  level={selected}
                  onBack={() => select(undefined)}
                />
              </div>
            ) : (
              <div className='bg-card hidden w-full flex-1 flex-col justify-center rounded-lg border sm:flex'>
                <EmptyState icon={Boxes} title={t('selectStockItem')} />
              </div>
            ))}
        </section>
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
        <Button variant='ghost' onClick={onDone} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button onClick={save} disabled={isPending || done === 0}>
          {isPending && <Spinner className='me-2' />}
          {t('saveCount')}
        </Button>
      </div>

      <ScrollArea className='-mx-3 h-full p-3'>
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
