import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ArrowRight,
  ChevronDown,
  ChevronsUpDown,
  CookingPot,
  Copy,
  FlaskConical,
  Package,
  Plus,
  X,
} from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { type RecipeView } from '@/api/inventory'
import {
  getRecipeCostsOptions,
  getRecipesOptions,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Combobox } from '@/components/combobox'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Grip, Sortable } from '@/components/sortable'
import { formatQuantity, unitLabel } from '@/features/inventory/format'
import {
  stockItemsQueryOptions,
  toStockItemOptions,
} from '@/features/inventory/queries'
import {
  choiceDeltas,
  standardChoiceNames,
  standardCost,
} from '@/features/inventory/recipe-cost'
import { isUnitRecipe } from '@/features/inventory/stock-rules'
import { useInventoryActions } from '@/features/inventory/use-inventory-actions'

type StockRuleSectionProps = {
  item: CatalogItemDto
}

/**
 * What one sale of this item takes out of stock. Three states: not
 * tracked; sold as a unit (a stock item of its own, one per sale); or a
 * recipe. A recipe is a list of sentences — "when the customer picks these
 * options, this much of this stock item comes off the shelf" — shown as
 * such, in one flat list, with a preview that picks options the way the
 * cashier does and shows what would be deducted.
 */
export function StockRuleSection({ item }: StockRuleSectionProps) {
  const t = useT()
  const localized = useLocalized()
  const catalogItemId = toNumber(item.id)
  const { trackByUnit, removeRecipe, isPending } = useInventoryActions()
  const [editing, setEditing] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)

  const recipes = useQuery(
    getRecipesOptions({ query: { 'api-version': API_VERSION } })
  )
  const stockItems = useQuery(stockItemsQueryOptions())
  const recipe = recipes.data?.find(
    (r) => toNumber(r.catalogItemId) === catalogItemId
  )
  const menu = useMemo(() => menuOptionsOf(item, localized), [item, localized])

  // One base line of exactly one piece is the unit shortcut's shape
  const unitLine = recipe && isUnitRecipe(recipe) ? recipe.lines[0] : null

  if (recipes.isLoading || stockItems.isLoading) {
    return <Skeleton className='h-9 w-64' />
  }

  const stop = async () => {
    try {
      await removeRecipe(catalogItemId)
      setStopOpen(false)
      setEditing(false)
    } catch {
      // toasted by useInventoryActions
    }
  }

  if (editing) {
    return (
      <RecipeEditor
        catalogItemId={catalogItemId}
        menu={menu}
        recipe={unitLine ? undefined : recipe}
        onDone={() => setEditing(false)}
      />
    )
  }

  if (!recipe) {
    return (
      <div className='space-y-3'>
        <p className='text-muted-foreground text-sm'>{t('notTrackedHint')}</p>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            disabled={isPending}
            onClick={() =>
              trackByUnit(catalogItemId, {
                en: item.name?.en ?? '',
                ar: item.name?.ar ?? null,
              }).catch(() => {
                // toasted by useInventoryActions
              })
            }
          >
            {isPending ? (
              <Spinner className='me-2' />
            ) : (
              <Package className='me-2 h-4 w-4' />
            )}
            {t('sellAsUnit')}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => setEditing(true)}
          >
            <CookingPot className='me-2 h-4 w-4' />
            {t('usesIngredients')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {unitLine ? (
        <p className='text-sm'>
          {t('soldAsUnit')}{' '}
          <Link
            to='/inventory'
            search={{ item: toNumber(unitLine.stockItemId) }}
            className='font-medium underline-offset-4 hover:underline'
          >
            {localized(unitLine.name)}
          </Link>
        </p>
      ) : (
        <RecipeSummary recipe={recipe} menu={menu} />
      )}
      <CostAndMargin item={item} />
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setEditing(true)}
        >
          <CookingPot className='me-2 h-4 w-4' />
          {unitLine ? t('usesIngredientsInstead') : t('editRecipe')}
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground'
          onClick={() => setStopOpen(true)}
        >
          <X className='me-2 h-4 w-4' />
          {t('stopTracking')}
        </Button>
      </div>

      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        destructive
        title={t('stopTrackingQuestion')}
        desc={t('stopTrackingDescription')}
        confirmText={t('stopTracking')}
        isLoading={isPending}
        handleConfirm={stop}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The item's customization options, in menu order

type MenuOption = {
  id: string
  label: string
  groupIndex: number
  index: number
  isDefault: boolean
}
type MenuGroup = {
  id: string
  label: string
  allowMultiple: boolean
  options: MenuOption[]
}
type MenuOptions = {
  groups: MenuGroup[]
  byId: Map<string, MenuOption>
}

function menuOptionsOf(
  item: CatalogItemDto,
  localized: (
    t: { en?: string | null; ar?: string | null } | null | undefined
  ) => string
): MenuOptions {
  const byOrder = <T extends { displayOrder?: number | string }>(a: T, b: T) =>
    toNumber(a.displayOrder) - toNumber(b.displayOrder)
  const byId = new Map<string, MenuOption>()
  const groups: MenuGroup[] = [...(item.customizations ?? [])]
    .sort(byOrder)
    .map((group, groupIndex) => ({
      id: String(group.id),
      label: localized(group.name),
      allowMultiple: group.allowMultiple === true,
      options: [...(group.options ?? [])].sort(byOrder).map((option, index) => {
        const entry = {
          id: String(option.id),
          label: localized(option.name),
          groupIndex,
          index,
          isDefault: option.isDefault === true,
        }
        byId.set(entry.id, entry)
        return entry
      }),
    }))
    .filter((group) => group.options.length > 0)
  return { groups, byId }
}

/** A line's options in menu order (group, then option); removed ones last */
function orderedOptions(
  optionIds: string[],
  menu: MenuOptions
): (MenuOption | null)[] {
  const known = optionIds
    .map((id) => menu.byId.get(id))
    .filter((o): o is MenuOption => !!o)
    .sort((a, b) => a.groupIndex - b.groupIndex || a.index - b.index)
  const removed = optionIds.filter((id) => !menu.byId.has(id)).map(() => null)
  return [...known, ...removed]
}

/** Mirrors the API: a line is used when every option it names was chosen */
const appliesTo = (optionIds: string[], chosen: ReadonlySet<string>) =>
  optionIds.every((id) => chosen.has(id))

/** The subject of a sentence: "light + spiced", or "every sale" when empty */
function OptionChips({
  optionIds,
  menu,
  className,
}: {
  optionIds: string[]
  menu: MenuOptions
  className?: string
}) {
  const t = useT()
  if (optionIds.length === 0) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        {t('everySale')}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {orderedOptions(optionIds, menu).map((option, i) => (
        <span key={option?.id ?? `removed-${i}`} className='contents'>
          {i > 0 && <span className='text-muted-foreground text-xs'>+</span>}
          <Badge
            variant='secondary'
            className={cn('font-normal', !option && 'text-muted-foreground')}
          >
            {option?.label ?? t('removedOption')}
          </Badge>
        </span>
      ))}
    </span>
  )
}

/** The arrow between "when they pick …" and "… comes off the shelf" */
const Arrow = () => (
  <ArrowRight className='text-muted-foreground h-3.5 w-3.5 shrink-0 rtl:-scale-x-100' />
)

// ---------------------------------------------------------------------------
// Read view

function RecipeSummary({
  recipe,
  menu,
}: {
  recipe: RecipeView
  menu: MenuOptions
}) {
  const t = useT()
  const localized = useLocalized()

  // In the order the back office arranged them
  const lines = recipe.lines
  const stock = new Map(
    recipe.lines.map((line) => [
      String(line.stockItemId),
      { label: localized(line.name), unit: line.unit ?? '' },
    ])
  )

  return (
    <div className='space-y-4'>
      <div className='divide-y text-sm'>
        {lines.map((line) => (
          <div
            key={String(line.id)}
            className='flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5'
          >
            <OptionChips optionIds={line.optionIds.map(String)} menu={menu} />
            <Arrow />
            <span className='whitespace-nowrap'>
              <span className='text-muted-foreground tabular-nums'>
                {formatQuantity(line.quantity, line.unit ?? '', t)}
              </span>{' '}
              <Link
                to='/inventory'
                search={{ item: toNumber(line.stockItemId) }}
                className='underline-offset-4 hover:underline'
              >
                {localized(line.name)}
              </Link>
            </span>
          </div>
        ))}
      </div>
      <DeductionPreview
        lines={recipe.lines.map((line) => ({
          stockItemId: String(line.stockItemId),
          quantity: toNumber(line.quantity),
          optionIds: line.optionIds.map(String),
        }))}
        menu={menu}
        stock={stock}
      />
    </div>
  )
}

/**
 * What one sale costs at the active branch against the item's price, for
 * the standard choice (the default of each option group), then what every
 * other choice adds. Inventory prices nothing; the join with Catalog's
 * price and defaults happens here.
 */
function CostAndMargin({ item }: { item: CatalogItemDto }) {
  const t = useT()
  const localized = useLocalized()
  const costs = useQuery(
    getRecipeCostsOptions({ query: { 'api-version': API_VERSION } })
  )
  const cost = costs.data?.find(
    (c) => toNumber(c.catalogItemId) === toNumber(item.id)
  )
  if (costs.isLoading) return <Skeleton className='h-24' />
  if (!cost) return null

  const price = toNumber(item.price)
  const standard = standardCost(cost, item)
  const margin = price - standard
  const foodCost = price > 0 ? Math.round((standard / price) * 100) : null
  const over = foodCost !== null && foodCost > FOOD_COST_TARGET
  const incomplete = cost.uncosted.length > 0
  const choices = standardChoiceNames(item, localized)
  const groups = choiceDeltas(cost, item)

  return (
    <div className='rounded-lg border'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-3 py-2'>
        <span className='text-sm font-medium'>{t('costOfOneSale')}</span>
        <span className='text-muted-foreground text-xs'>
          {choices.length > 0
            ? t('withStandardChoices', { choices: choices.join(' · ') })
            : t('noChoicesAffectCost')}
        </span>
      </div>

      <dl className='grid grid-cols-3 divide-x px-1 py-2 text-center rtl:divide-x-reverse'>
        <div className='px-2'>
          <dt className='text-muted-foreground text-xs'>{t('costLabel')}</dt>
          <dd className='text-lg font-semibold tabular-nums'>
            {formatEgp(standard)}
            {incomplete && (
              <span
                className='text-warning ms-0.5 text-sm'
                title={t('costIncomplete', { count: cost.uncosted.length })}
              >
                +
              </span>
            )}
          </dd>
        </div>
        <div className='px-2'>
          <dt className='text-muted-foreground text-xs'>{t('margin')}</dt>
          <dd
            className={cn(
              'text-lg font-semibold tabular-nums',
              margin < 0 && 'text-destructive'
            )}
          >
            {price > 0 ? formatEgp(margin) : '—'}
          </dd>
        </div>
        <div className='px-2'>
          <dt className='text-muted-foreground text-xs'>
            {t('foodCostPercent')}
          </dt>
          <dd
            className={cn(
              'text-lg font-semibold tabular-nums',
              over && 'text-destructive'
            )}
          >
            {foodCost === null ? '—' : `${foodCost}%`}
          </dd>
          {foodCost !== null && (
            <div className='bg-muted mx-auto mt-1 h-1 w-24 overflow-hidden rounded-full'>
              <div
                className={cn('h-full', over ? 'bg-destructive' : 'bg-primary')}
                style={{ width: `${Math.min(100, foodCost)}%` }}
              />
            </div>
          )}
        </div>
      </dl>

      {incomplete && (
        <p className='text-warning border-t px-3 py-1.5 text-xs'>
          {t('costIncompleteHint', { count: cost.uncosted.length })}
        </p>
      )}

      {groups.length > 0 && (
        <div className='space-y-1.5 border-t px-3 py-2'>
          <div className='text-muted-foreground text-xs'>{t('byChoice')}</div>
          {groups.map((group) => (
            <div
              key={group.id}
              className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'
            >
              <span className='text-muted-foreground min-w-16'>
                {localized(group.name)}
              </span>
              {group.options.map((option) => (
                <span
                  key={option.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs tabular-nums',
                    option.isDefault
                      ? 'bg-muted/60'
                      : option.delta === 0 && 'text-muted-foreground'
                  )}
                >
                  {localized(option.name)}
                  {option.isDefault ? (
                    <span className='text-muted-foreground'>
                      · {t('standardChoice')}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        option.delta > 0 && 'text-destructive/80',
                        option.delta < 0 && 'text-success'
                      )}
                    >
                      {option.delta > 0 ? '+' : ''}
                      {formatEgp(option.delta)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Food cost above this share of the price is flagged; the menu-cost report lets the owner change it */
const FOOD_COST_TARGET = 35

// ---------------------------------------------------------------------------
// Preview: pick like the cashier, see what comes off the shelf

type PreviewLine = {
  stockItemId: string
  quantity: number
  optionIds: string[]
}
type StockInfo = { label: string; unit: string }

/**
 * The sum the API would post for one unit sold with these options: every
 * matching line, added per stock item. Shows the parts when more than one
 * line contributes, which is exactly where a double count would hide.
 * Folded away until asked for: it is a check, not part of the recipe.
 */
function DeductionPreview({
  lines,
  menu,
  stock,
}: {
  lines: PreviewLine[]
  menu: MenuOptions
  stock: Map<string, StockInfo>
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() =>
    menu.groups
      .flatMap((g) => g.options.filter((o) => o.isDefault))
      .map((o) => o.id)
  )

  if (menu.groups.length === 0) return null

  const chosenSet = new Set(chosen)
  const totals = new Map<string, number[]>()
  for (const line of lines) {
    if (!appliesTo(line.optionIds, chosenSet)) continue
    totals.set(line.stockItemId, [
      ...(totals.get(line.stockItemId) ?? []),
      line.quantity,
    ])
  }

  const pickGroup = (group: MenuGroup, values: string[]) => {
    const siblings = new Set(group.options.map((o) => o.id))
    setChosen((prev) => [...prev.filter((id) => !siblings.has(id)), ...values])
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground h-7 px-2'
        >
          <FlaskConical className='me-1 h-3.5 w-3.5' />
          {t('tryIt')}
          <ChevronDown
            className={cn(
              'ms-1 h-3.5 w-3.5 transition-transform',
              open && 'rotate-180'
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='mt-2 space-y-3 rounded-lg border p-3'>
        <p className='text-muted-foreground text-xs'>{t('tryItHint')}</p>
        <div className='space-y-2'>
          {menu.groups.map((group) => {
            const inGroup = group.options
              .map((o) => o.id)
              .filter((id) => chosenSet.has(id))
            const items = group.options.map((option) => (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                className='data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-2.5 text-xs'
              >
                {option.label}
              </ToggleGroupItem>
            ))
            return (
              <div
                key={group.id}
                className='flex flex-wrap items-center gap-x-3 gap-y-1'
              >
                <span className='text-muted-foreground w-24 shrink-0 truncate text-xs'>
                  {group.label}
                </span>
                {group.allowMultiple ? (
                  <ToggleGroup
                    type='multiple'
                    variant='outline'
                    size='sm'
                    value={inGroup}
                    onValueChange={(values) => pickGroup(group, values)}
                    className='flex-wrap'
                  >
                    {items}
                  </ToggleGroup>
                ) : (
                  <ToggleGroup
                    type='single'
                    variant='outline'
                    size='sm'
                    value={inGroup[0] ?? ''}
                    onValueChange={(value) =>
                      pickGroup(group, value ? [value] : [])
                    }
                    className='flex-wrap'
                  >
                    {items}
                  </ToggleGroup>
                )}
              </div>
            )
          })}
        </div>
        {totals.size === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('nothingDeducted')}
          </p>
        ) : (
          <ul className='space-y-1 text-sm'>
            {[...totals].map(([stockItemId, parts]) => {
              const info = stock.get(stockItemId)
              const unit = info?.unit ?? ''
              const total = parts.reduce((sum, q) => sum + q, 0)
              return (
                <li
                  key={stockItemId}
                  className='flex flex-wrap items-baseline gap-x-2'
                >
                  <span className='font-medium'>{info?.label ?? '—'}</span>
                  <span className='tabular-nums'>
                    {formatQuantity(total, unit, t)}
                  </span>
                  {parts.length > 1 && (
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      (
                      {parts.map((q) => formatQuantity(q, unit, t)).join(' + ')}
                      )
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Editor

type Line = {
  key: number
  stockItemId: string | null
  quantity: string
  /** Customization option ids this line is tied to; empty = every sale */
  optionIds: string[]
}

let lineKey = 0
const newLine = (
  stockItemId: string | null = null,
  quantity = '',
  optionIds: string[] = []
): Line => ({ key: lineKey++, stockItemId, quantity, optionIds })

/** Order-independent identity of an option set, for the duplicate check */
const optionSetKey = (optionIds: string[]) =>
  [...optionIds].sort((a, b) => Number(a) - Number(b)).join('+')

function RecipeEditor({
  catalogItemId,
  menu,
  recipe,
  onDone,
}: {
  catalogItemId: number
  menu: MenuOptions
  recipe: RecipeView | undefined
  onDone: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const { setRecipe, isPending } = useInventoryActions()
  // The compiler memoizes these; a manual useMemo over a query result trips
  // the query lint rule
  const { data: stockItems = [] } = useQuery(stockItemsQueryOptions())
  const stockById = new Map(stockItems.map((i) => [String(i.id), i]))
  const stockOptions = toStockItemOptions(stockItems, localized, t)
  const stock = new Map<string, StockInfo>(
    stockItems.map((i) => [
      String(i.id),
      { label: localized(i.name), unit: i.unit ?? '' },
    ])
  )

  // Saved order; new lines go to the end and the grip moves any of them
  const [lines, setLines] = useState<Line[]>(() =>
    (recipe?.lines ?? []).map((line) =>
      newLine(
        String(line.stockItemId),
        String(toNumber(line.quantity)),
        line.optionIds.map(String)
      )
    )
  )

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the grip
    // does nothing surprising
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setLines((prev) => {
      const from = prev.findIndex((l) => String(l.key) === active.id)
      const to = prev.findIndex((l) => String(l.key) === over.id)
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to)
    })
  }

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
  const removeLine = (key: number) =>
    setLines((prev) => prev.filter((l) => l.key !== key))
  const addLine = () => setLines((prev) => [...prev, newLine()])
  // The double-size workflow: copy the line, then add the option to it
  const copyLine = (key: number) =>
    setLines((prev) =>
      prev.flatMap((line) =>
        line.key === key
          ? [
              line,
              newLine(line.stockItemId, line.quantity, [...line.optionIds]),
            ]
          : [line]
      )
    )

  // A stock item may appear once per option set, not twice for the same
  // set — the API rejects that too. Flagged live, on the later of the two.
  const seen = new Set<string>()
  const duplicates = new Set<number>()
  for (const line of lines) {
    if (!line.stockItemId) continue
    const pair = `${line.stockItemId}/${optionSetKey(line.optionIds)}`
    if (seen.has(pair)) duplicates.add(line.key)
    seen.add(pair)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      toast.error(t('recipeNeedsLine'))
      return
    }
    if (
      !lines.every((line) => line.stockItemId && parseFloat(line.quantity) > 0)
    ) {
      toast.error(t('recipeLineIncomplete'))
      return
    }
    if (duplicates.size > 0) {
      toast.error(t('recipeDuplicateLine'))
      return
    }
    try {
      await setRecipe(catalogItemId, {
        lines: lines.map((line) => ({
          stockItemId: Number(line.stockItemId),
          quantity: parseFloat(line.quantity),
          optionIds: line.optionIds.map(Number),
        })),
      })
      onDone()
    } catch {
      // toasted by useInventoryActions
    }
  }

  const previewLines: PreviewLine[] = lines
    .filter((line) => line.stockItemId && parseFloat(line.quantity) > 0)
    .map((line) => ({
      stockItemId: line.stockItemId!,
      quantity: parseFloat(line.quantity),
      optionIds: line.optionIds,
    }))

  // One row per rule, a grip first. The option set and the stock item
  // share the width and each wraps when long, so nothing is ever cut off.
  const columns =
    'grid grid-cols-[auto_minmax(0,1fr)_auto_6rem_minmax(0,1fr)_auto] gap-2'

  return (
    <form onSubmit={save} className='space-y-5'>
      <div className='space-y-2'>
        <p className='text-muted-foreground text-xs'>
          {t('recipeSentenceHint')}
        </p>

        {lines.length > 0 && (
          <div className={cn(columns, 'text-muted-foreground text-xs')}>
            <span className='w-8' />
            <span>{t('whenTheyPick')}</span>
            <span />
            <span>{t('quantity')}</span>
            <span>{t('stockItem')}</span>
            <span />
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={lines.map((l) => String(l.key))}
            strategy={verticalListSortingStrategy}
          >
            <div className='space-y-2'>
              {lines.map((line) => {
                const stockItem = line.stockItemId
                  ? stockById.get(line.stockItemId)
                  : undefined
                const duplicate = duplicates.has(line.key)
                return (
                  <Sortable
                    key={line.key}
                    id={String(line.key)}
                    as='div'
                    className={cn(
                      columns,
                      'items-center',
                      duplicate && 'ring-destructive/40 rounded-md ring-2'
                    )}
                  >
                    {(activator, grip) => (
                      <>
                        <Grip
                          activator={activator}
                          grip={grip}
                          label={t('reorder')}
                        />
                        <LineOptionsPicker
                          value={line.optionIds}
                          onChange={(optionIds) =>
                            updateLine(line.key, { optionIds })
                          }
                          menu={menu}
                        />
                        <Arrow />
                        <div className='relative'>
                          <Input
                            type='number'
                            min='0'
                            step='any'
                            placeholder={t('quantity')}
                            aria-label={t('quantity')}
                            className={cn('h-8', stockItem && 'pe-9')}
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(line.key, { quantity: e.target.value })
                            }
                          />
                          {stockItem && (
                            <span className='text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs'>
                              {unitLabel(stockItem.unit, t)}
                            </span>
                          )}
                        </div>
                        <Combobox
                          value={line.stockItemId}
                          onChange={(value) =>
                            updateLine(line.key, { stockItemId: value })
                          }
                          options={stockOptions}
                          placeholder={t('pickStockItem')}
                          size='sm'
                          wrap
                        />
                        <div className='flex'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='text-muted-foreground size-8'
                            aria-label={t('copyLine')}
                            title={t('copyLine')}
                            onClick={() => copyLine(line.key)}
                          >
                            <Copy className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='size-8'
                            aria-label={t('removeLine')}
                            onClick={() => removeLine(line.key)}
                          >
                            <X className='h-4 w-4' />
                          </Button>
                        </div>
                      </>
                    )}
                  </Sortable>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground h-7 px-2'
          onClick={addLine}
        >
          <Plus className='me-1 h-3.5 w-3.5' />
          {t('addIngredient')}
        </Button>
      </div>

      <DeductionPreview lines={previewLines} menu={menu} stock={stock} />

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' size='sm' onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type='submit' size='sm' disabled={isPending}>
          {isPending && <Spinner className='me-2' />}
          {t('save')}
        </Button>
      </div>
    </form>
  )
}

/**
 * The options a line needs, all of them: one pick per single-choice group,
 * any number from a multi-choice one. Nothing picked means every sale.
 */
function LineOptionsPicker({
  value,
  onChange,
  menu,
}: {
  value: string[]
  onChange: (optionIds: string[]) => void
  menu: MenuOptions
}) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const chosen = new Set(value)
  const removed = value.filter((v) => !menu.byId.has(v))

  const toggle = (group: MenuGroup, optionId: string, checked: boolean) => {
    if (!checked) {
      onChange(value.filter((v) => v !== optionId))
      return
    }
    const siblings = new Set(group.options.map((o) => o.id))
    const kept = group.allowMultiple
      ? value
      : value.filter((v) => !siblings.has(v))
    onChange([...kept, optionId])
  }

  // An item with no customizations: every line is an every-sale line
  if (menu.groups.length === 0 && removed.length === 0) {
    return (
      <span className='text-muted-foreground px-2 text-xs'>
        {t('everySale')}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          // Grows with its chips: a three-option line must stay readable
          className='h-auto min-h-8 w-full justify-between px-2 py-1 text-xs font-normal'
        >
          <OptionChips
            optionIds={value}
            menu={menu}
            className='min-w-0 justify-start text-start'
          />
          <ChevronsUpDown className='ms-1 h-3.5 w-3.5 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-56 space-y-3 p-3' align='start'>
        {menu.groups.map((group) => (
          <div key={group.id} className='space-y-1.5'>
            <p className='text-muted-foreground px-1 text-xs font-medium'>
              {group.label}
            </p>
            {group.options.map((option) => {
              const inputId = `${id}-${option.id}`
              return (
                <div key={option.id} className='flex items-center gap-2 px-1'>
                  <Checkbox
                    id={inputId}
                    checked={chosen.has(option.id)}
                    onCheckedChange={(checked) =>
                      toggle(group, option.id, checked === true)
                    }
                  />
                  <Label htmlFor={inputId} className='font-normal'>
                    {option.label}
                  </Label>
                </div>
              )
            })}
          </div>
        ))}
        {removed.map((removedId) => {
          const inputId = `${id}-${removedId}`
          return (
            <div key={removedId} className='flex items-center gap-2 px-1'>
              <Checkbox
                id={inputId}
                checked
                onCheckedChange={() =>
                  onChange(value.filter((v) => v !== removedId))
                }
              />
              <Label
                htmlFor={inputId}
                className='text-muted-foreground font-normal'
              >
                {t('removedOption')}
              </Label>
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
