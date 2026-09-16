import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Wrench,
} from 'lucide-react'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import {
  getStockMovements,
  type StockItemView,
  type StockLevelView,
} from '@/api/inventory'
import {
  getRecipesOptions,
  getStockItemCostsOptions,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  actorLabel,
  costChange,
  formatQuantity,
  formatSignedQuantity,
  MOVEMENT_ADJUSTMENT,
  MOVEMENT_WASTE,
  packsOf,
  referenceLabel,
  unitLabel,
} from '../format'
import { useInventoryActions } from '../use-inventory-actions'
import { MovementTypeBadge } from './movement-type-badge'
import { ReorderLevelPopover } from './reorder-level-popover'
import { StockItemDialog } from './stock-item-dialog'

type StockItemPanelProps = {
  level: StockLevelView
  onBack: () => void
}

/**
 * The end side of the stock split: the selected item's level as the one
 * big number, its reorder level editable in place, the quick fixes a
 * manager posts by hand (waste, a return, a correction), what
 * moved recently and which menu items consume it.
 */
export function StockItemPanel({ level, onBack }: StockItemPanelProps) {
  const t = useT()
  const localized = useLocalized()
  const { updateItem, isPending } = useInventoryActions()
  const [editOpen, setEditOpen] = useState(false)
  const [retireOpen, setRetireOpen] = useState(false)

  const packs = packsOf(level.onHand, level.packSize)
  const stockItemId = toNumber(level.stockItemId)

  // StockItemDialog edits the global item; the level carries the same fields
  const asItem: StockItemView = {
    id: stockItemId,
    name: level.name,
    unit: level.unit,
    packSize: level.packSize,
    packName: level.packName,
    autoSoldOut: level.autoSoldOut,
    isActive: level.isActive,
  }

  const setActive = async (isActive: boolean) => {
    try {
      await updateItem(stockItemId, { ...asItem, isActive })
      setRetireOpen(false)
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex flex-none items-center justify-between gap-2 border-b p-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button
            size='icon'
            variant='ghost'
            className='-ms-2 sm:hidden'
            onClick={onBack}
            aria-label={t('backToStock')}
          >
            <ArrowLeft className='rtl:rotate-180' />
          </Button>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-2'>
              <h2 className='truncate text-sm font-semibold'>
                {localized(level.name)}
              </h2>
              {level.autoSoldOut && (
                <Badge variant='secondary'>{t('autoSoldOut')}</Badge>
              )}
              {!level.isActive && (
                <Badge variant='outline'>{t('retired')}</Badge>
              )}
            </div>
            <p className='text-muted-foreground truncate text-xs'>
              {unitLabel(level.unit, t)}
              {level.packSize != null && toNumber(level.packSize) > 0 && (
                <>
                  {' · '}
                  {t('packOf', {
                    packSize: String(toNumber(level.packSize)),
                    unit: unitLabel(level.unit, t),
                    packName: level.packName || t('pack'),
                  })}
                </>
              )}
            </p>
          </div>
        </div>
        <div className='flex flex-none items-center gap-2'>
          {!level.isActive && (
            <Button onClick={() => setActive(true)} disabled={isPending}>
              {isPending ? (
                <Spinner className='me-2' />
              ) : (
                <ArchiveRestore className='me-2 h-4 w-4' />
              )}
              {t('restoreItem')}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='icon' variant='ghost' aria-label={t('actions')}>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className='h-4 w-4' />
                {t('editStockItem')}
              </DropdownMenuItem>
              {level.isActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant='destructive'
                    onClick={() => setRetireOpen(true)}
                  >
                    <Archive className='h-4 w-4' />
                    {t('retireItem')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {/* The level */}
        <section className='space-y-1 p-4'>
          <div className='text-muted-foreground text-xs font-medium'>
            {t('onHand')}
          </div>
          <div
            className={cn(
              'text-4xl font-semibold tracking-tight tabular-nums',
              level.isLow && 'text-destructive'
            )}
          >
            {formatQuantity(level.onHand, level.unit, t)}
            {level.isLow && (
              <Badge variant='destructive' className='ms-3 align-middle'>
                {t('lowBadge')}
              </Badge>
            )}
          </div>
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm'>
            {packs !== null && (
              <>
                <span className='tabular-nums'>
                  {t('approxPacks', {
                    packs,
                    packName: level.packName || t('pack'),
                  })}
                </span>
                <span>·</span>
              </>
            )}
            <ReorderLevelPopover level={level} />
            <span>·</span>
            <span className='tabular-nums'>
              {t('avgCostLine', { cost: formatEgp(level.avgUnitCost) })}
            </span>
            <span>·</span>
            <span className='tabular-nums'>
              {t('worthLine', { value: formatEgp(level.value) })}
            </span>
          </div>
          <UsedBy stockItemId={stockItemId} />
        </section>

        {level.isActive && <QuickFix key={stockItemId} level={level} />}

        <CostHistory stockItemId={stockItemId} unit={level.unit} />

        <Movements stockItemId={stockItemId} />
      </div>

      <StockItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={asItem}
      />

      <ConfirmDialog
        open={retireOpen}
        onOpenChange={setRetireOpen}
        destructive
        title={t('retireItemQuestion', { name: localized(level.name) })}
        desc={t('retireItemDescription')}
        confirmText={t('retireItem')}
        isLoading={isPending}
        handleConfirm={() => setActive(false)}
      />
    </div>
  )
}

type FixKind = 'waste' | 'return' | 'correction'

const fixKinds: {
  kind: FixKind
  type: typeof MOVEMENT_WASTE | typeof MOVEMENT_ADJUSTMENT
  /** Sign the typed quantity gets; `null` lets the user type it */
  sign: 1 | -1 | null
}[] = [
  { kind: 'waste', type: MOVEMENT_WASTE, sign: 1 },
  { kind: 'return', type: MOVEMENT_ADJUSTMENT, sign: 1 },
  { kind: 'correction', type: MOVEMENT_ADJUSTMENT, sign: null },
]

/**
 * The by-hand postings, one tap to pick why and one field for how much.
 * Waste removes; a return adds; a correction takes a signed quantity. The reason posted is the label plus whatever note was typed.
 */
function QuickFix({ level }: { level: StockLevelView }) {
  const t = useT()
  const { postAdjustment, isPending } = useInventoryActions()
  const [kind, setKind] = useState<FixKind | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  const labels: Record<FixKind, string> = {
    waste: t('movementTypeWaste'),
    return: t('reasonReturnToStock'),
    correction: t('reasonCorrection'),
  }

  const picked = fixKinds.find((k) => k.kind === kind)
  const parsed = parseFloat(quantity)
  const valid =
    picked &&
    (picked.sign === null ? parsed !== 0 : parsed > 0) &&
    !isNaN(parsed)

  const reset = () => {
    setKind(null)
    setQuantity('')
    setNote('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!picked || !valid) return
    const qty =
      picked.type === MOVEMENT_WASTE
        ? Math.abs(parsed)
        : picked.sign === null
          ? parsed
          : Math.abs(parsed)
    const reason = note.trim()
      ? `${labels[picked.kind]}: ${note.trim()}`
      : labels[picked.kind]
    try {
      await postAdjustment({
        stockItemId: toNumber(level.stockItemId),
        type: picked.type,
        quantity: qty,
        reason,
        unitCost: null,
      })
      reset()
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <section className='space-y-3 border-t p-4'>
      <h3 className='flex items-center gap-2 text-sm font-medium'>
        <Wrench className='text-muted-foreground h-4 w-4' />
        {t('fixTheLevel')}
      </h3>
      <ToggleGroup
        type='single'
        variant='outline'
        value={kind ?? ''}
        onValueChange={(value) => setKind((value as FixKind) || null)}
        className='max-w-full overflow-x-auto'
      >
        {fixKinds.map((k) => (
          <ToggleGroupItem key={k.kind} value={k.kind} className='px-3'>
            {labels[k.kind]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {picked && (
        <form
          onSubmit={submit}
          className='flex flex-wrap items-end gap-3 rounded-md'
        >
          <div className='w-36 space-y-1.5'>
            <Label htmlFor='fix-quantity'>
              {t('quantity')} ({unitLabel(level.unit, t)})
            </Label>
            <Input
              id='fix-quantity'
              type='number'
              step='any'
              min={picked.sign === null ? undefined : '0'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
          </div>
          <div className='min-w-40 flex-1 space-y-1.5'>
            <Label htmlFor='fix-note'>{t('notesOptional')}</Label>
            <Input
              id='fix-note'
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className='flex gap-2'>
            <Button type='button' variant='ghost' onClick={reset}>
              {t('cancel')}
            </Button>
            <Button type='submit' disabled={!valid || isPending}>
              {isPending && <Spinner className='me-2' />}
              {t('postFix')}
            </Button>
          </div>
          <p className='text-muted-foreground w-full text-xs'>
            {picked.sign === null
              ? t('adjustmentQuantityHint')
              : picked.sign > 0 && picked.type === MOVEMENT_ADJUSTMENT
                ? t('addQuantityHint')
                : t('removeQuantityHint')}
          </p>
        </form>
      )}
    </section>
  )
}

const PAGE_SIZE = 30

/**
 * The item's whole ledger, newest first, fetched a page at a time as the
 * panel is scrolled to the bottom. Keyed under the generated query id so
 * the postings' invalidation refreshes it too.
 */
/**
 * What the branch paid for the item, receipt by receipt, newest first, each
 * against the one before it so a creeping price is a column of red.
 */
function CostHistory({
  stockItemId,
  unit,
}: {
  stockItemId: number
  unit: string
}) {
  const t = useT()
  const locale = useLocale()
  const query = useQuery(
    getStockItemCostsOptions({
      path: { id: stockItemId },
      query: { 'api-version': API_VERSION, take: 12 },
    })
  )
  const day = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    [locale]
  )
  const rows = query.data ?? []
  if (query.isLoading) return null
  if (rows.length === 0) return null

  return (
    <section className='space-y-2 border-t p-4'>
      <h3 className='text-sm font-medium'>{t('costHistory')}</h3>
      <ul className='divide-y text-sm'>
        {rows.map((r, i) => {
          const previous = rows[i + 1]
          const change = previous
            ? costChange(toNumber(r.unitCost), toNumber(previous.unitCost))
            : null
          return (
            <li
              key={`${r.at}-${String(r.purchaseId ?? i)}`}
              className='flex items-center gap-3 py-1.5'
            >
              <span className='text-muted-foreground w-16 shrink-0 text-xs tabular-nums'>
                {day.format(new Date(r.at))}
              </span>
              <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
                {r.supplier || t('noSupplier')}
                {' · '}
                {formatQuantity(r.quantity, unit, t)}
              </span>
              <span className='tabular-nums'>
                {formatEgp(r.unitCost)}
                <span className='text-muted-foreground text-xs'>
                  {' / '}
                  {unitLabel(unit, t)}
                </span>
              </span>
              <span
                className={cn(
                  'w-12 text-end text-xs tabular-nums',
                  change?.flagged
                    ? change.percent > 0
                      ? 'text-destructive'
                      : 'text-success'
                    : 'text-muted-foreground'
                )}
              >
                {change
                  ? `${change.percent > 0 ? '+' : ''}${change.percent}%`
                  : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Movements({ stockItemId }: { stockItemId: number }) {
  const t = useT()
  const locale = useLocale()
  const query = useInfiniteQuery({
    queryKey: [{ _id: 'getStockMovements', stockItemId, infinite: true }],
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await getStockMovements({
        query: {
          'api-version': API_VERSION,
          stockItemId,
          pageIndex: pageParam,
          pageSize: PAGE_SIZE,
        },
        signal,
        throwOnError: true,
      })
      return data
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      pages.length * PAGE_SIZE < toNumber(last.totalCount)
        ? pages.length
        : undefined,
  })
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [locale]
  )
  const rows = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = toNumber(query.data?.pages[0]?.totalCount)

  // Fetch the next page when the sentinel scrolls into view
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <section className='space-y-2 border-t p-4'>
      <h3 className='flex items-baseline gap-2 text-sm font-medium'>
        {t('inventoryMovements')}
        {total > 0 && (
          <span className='text-muted-foreground text-xs font-normal tabular-nums'>
            {total}
          </span>
        )}
      </h3>
      {query.isLoading ? (
        <div className='space-y-2'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-8' />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('noMovementsYet')}</p>
      ) : (
        <ul className='divide-y text-sm'>
          {rows.map((m) => {
            const qty = toNumber(m.quantity)
            return (
              <li key={String(m.id)} className='flex items-center gap-3 py-2'>
                <span className='text-muted-foreground w-24 shrink-0 text-xs tabular-nums'>
                  {dateTime.format(new Date(m.recordedAt))}
                </span>
                <MovementTypeBadge type={m.type} />
                <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
                  {m.reason || referenceLabel(m.reference, t)}
                  {m.recordedBy && ` · ${actorLabel(m.recordedBy, t)}`}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-medium tabular-nums',
                    qty < 0 ? 'text-destructive' : 'text-success'
                  )}
                >
                  {formatSignedQuantity(m.quantity, m.unit, t)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div ref={sentinel} className='flex h-8 items-center justify-center'>
        {isFetchingNextPage && <Spinner />}
      </div>
    </section>
  )
}

/** Menu items whose recipe takes this stock item, as one line under the level */
function UsedBy({ stockItemId }: { stockItemId: number }) {
  const t = useT()
  const localized = useLocalized()
  const recipes = useQuery(
    getRecipesOptions({ query: { 'api-version': API_VERSION } })
  )
  const catalog = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )

  const users = useMemo(() => {
    const byId = new Map(
      (catalog.data ?? []).map((item) => [toNumber(item.id), item])
    )
    return (recipes.data ?? [])
      .filter((r) =>
        r.lines.some((line) => toNumber(line.stockItemId) === stockItemId)
      )
      .map((r) => ({
        id: toNumber(r.catalogItemId),
        name:
          localized(byId.get(toNumber(r.catalogItemId))?.name) ||
          t('unknownMenuItem'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes.data, catalog.data, stockItemId, localized, t])

  if (recipes.isLoading || catalog.isLoading) {
    return <Skeleton className='mt-1 h-4 w-40' />
  }

  return (
    <p className='text-muted-foreground flex flex-wrap items-center gap-x-1 pt-1 text-sm'>
      <span>{t('usedBy')}:</span>
      {users.length === 0 ? (
        <span>{t('notUsedYet')}</span>
      ) : (
        users.map((u, i) => (
          <span key={u.id}>
            <Link
              to='/menu'
              search={{ q: u.name }}
              className='text-foreground underline-offset-4 hover:underline'
            >
              {u.name}
            </Link>
            {i < users.length - 1 && ','}
          </span>
        ))
      )}
    </p>
  )
}
