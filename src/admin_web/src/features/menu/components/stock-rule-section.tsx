import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronsUpDown, CookingPot, Package, Plus, X } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { type RecipeView } from '@/api/inventory'
import { getRecipesOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Combobox } from '@/components/combobox'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { unitLabel } from '@/features/inventory/format'
import {
  stockItemsQueryOptions,
  toStockItemOptions,
} from '@/features/inventory/queries'
import { useInventoryActions } from '@/features/inventory/use-inventory-actions'

type StockRuleSectionProps = {
  item: CatalogItemDto
}

/**
 * What one sale of this item takes out of stock. Three states: not
 * tracked; sold as a unit (a stock item of its own, one per sale); or a
 * recipe — what every sale takes, then what each customization option adds
 * on top. A choice that replaces an ingredient (oat milk for regular) is a
 * required group whose options each add their own.
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
  const unitLine =
    recipe &&
    recipe.lines.length === 1 &&
    toNumber(recipe.lines[0].quantity) === 1 &&
    recipe.lines[0].optionIds.length === 0 &&
    recipe.lines[0].unit === 'pcs'
      ? recipe.lines[0]
      : null

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
// The item's customization options, in menu order, and where a line belongs

type MenuOption = { id: string; label: string; groupIndex: number }
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
      options: [...(group.options ?? [])].sort(byOrder).map((option) => {
        const entry = {
          id: String(option.id),
          label: localized(option.name),
          groupIndex,
        }
        byId.set(entry.id, entry)
        return entry
      }),
    }))
    .filter((group) => group.options.length > 0)
  return { groups, byId }
}

/**
 * Which block a line is shown under: the first of its options in menu
 * order; the rest are its "only with" narrowing. `'removed'` when none of
 * its options is on the menu any more.
 */
function primaryOf(
  optionIds: string[],
  menu: MenuOptions
): string | 'removed' | null {
  if (optionIds.length === 0) return null
  const known = optionIds
    .map((id) => menu.byId.get(id))
    .filter((o): o is MenuOption => !!o)
  if (known.length === 0) return 'removed'
  known.sort((a, b) => a.groupIndex - b.groupIndex)
  return known[0].id
}

/** "only with Spiced" for the options beyond the primary one */
function narrowingLabel(
  optionIds: string[],
  primary: string,
  menu: MenuOptions,
  t: ReturnType<typeof useT>
): string | null {
  const rest = optionIds.filter((id) => id !== primary)
  if (rest.length === 0) return null
  return rest
    .map((id) => menu.byId.get(id)?.label ?? t('removedOption'))
    .join(' + ')
}

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

  const ingredient = (line: RecipeView['lines'][number]) => (
    <span key={String(line.id)} className='whitespace-nowrap'>
      <Link
        to='/inventory'
        search={{ item: toNumber(line.stockItemId) }}
        className='underline-offset-4 hover:underline'
      >
        {localized(line.name)}
      </Link>{' '}
      <span className='text-muted-foreground tabular-nums'>
        {toNumber(line.quantity)} {unitLabel(line.unit, t)}
      </span>
    </span>
  )

  const base = recipe.lines.filter((l) => l.optionIds.length === 0)
  const byPrimary = new Map<string, RecipeView['lines']>()
  for (const line of recipe.lines) {
    const primary = primaryOf(line.optionIds.map(String), menu)
    if (!primary) continue
    byPrimary.set(primary, [...(byPrimary.get(primary) ?? []), line])
  }

  const row = (label: React.ReactNode, lines: RecipeView['lines']) => (
    <div className='flex gap-3 py-1.5 text-sm'>
      <span className='text-muted-foreground w-28 shrink-0 truncate'>
        {label}
      </span>
      <span className='flex min-w-0 flex-wrap gap-x-3 gap-y-1'>
        {lines.map((line) => {
          const primary = primaryOf(line.optionIds.map(String), menu)
          const narrowing =
            primary && primary !== 'removed'
              ? narrowingLabel(line.optionIds.map(String), primary, menu, t)
              : null
          return (
            <span key={String(line.id)}>
              {ingredient(line)}
              {narrowing && (
                <span className='text-muted-foreground text-xs'>
                  {' '}
                  · {t('onlyWith')} {narrowing}
                </span>
              )}
            </span>
          )
        })}
      </span>
    </div>
  )

  return (
    <div className='divide-y'>
      {base.length > 0 && row(t('everySale'), base)}
      {menu.groups.map((group) => {
        const options = group.options.filter((o) => byPrimary.has(o.id))
        if (options.length === 0) return null
        return (
          <div key={group.id} className='py-1'>
            <div className='text-muted-foreground pt-1 text-xs font-medium'>
              {group.label}
            </div>
            {options.map((option) => (
              <div key={option.id}>
                {row(option.label, byPrimary.get(option.id)!)}
              </div>
            ))}
          </div>
        )
      })}
      {byPrimary.has('removed') &&
        row(t('removedOption'), byPrimary.get('removed')!)}
    </div>
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

  const [lines, setLines] = useState<Line[]>(() =>
    (recipe?.lines ?? []).map((line) =>
      newLine(
        String(line.stockItemId),
        String(toNumber(line.quantity)),
        line.optionIds.map(String)
      )
    )
  )

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
  const removeLine = (key: number) =>
    setLines((prev) => prev.filter((l) => l.key !== key))
  const addLine = (optionIds: string[]) =>
    setLines((prev) => [...prev, newLine(null, '', optionIds)])

  const base = lines.filter((l) => l.optionIds.length === 0)
  const byPrimary = new Map<string, Line[]>()
  for (const line of lines) {
    const primary = primaryOf(line.optionIds, menu)
    if (!primary) continue
    byPrimary.set(primary, [...(byPrimary.get(primary) ?? []), line])
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
    // A stock item may appear once per option set, not twice for the same
    // set — the API rejects that too
    const pairs = lines.map(
      (line) => `${line.stockItemId}/${optionSetKey(line.optionIds)}`
    )
    if (new Set(pairs).size !== pairs.length) {
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

  const renderLine = (line: Line, primary: string | null) => {
    const stockItem = line.stockItemId
      ? stockById.get(line.stockItemId)
      : undefined
    return (
      <div
        key={line.key}
        className='grid grid-cols-[minmax(0,1fr)_88px_auto_auto] items-center gap-2'
      >
        <Combobox
          value={line.stockItemId}
          onChange={(value) => updateLine(line.key, { stockItemId: value })}
          options={stockOptions}
          placeholder={t('pickStockItem')}
          size='sm'
        />
        <div className='relative'>
          <Input
            type='number'
            min='0'
            step='any'
            placeholder={t('quantity')}
            aria-label={t('quantity')}
            className={cn('h-8', stockItem && 'pe-9')}
            value={line.quantity}
            onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
          />
          {stockItem && (
            <span className='text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs'>
              {unitLabel(stockItem.unit, t)}
            </span>
          )}
        </div>
        {primary ? (
          <OnlyWithPicker
            primary={primary}
            value={line.optionIds}
            onChange={(optionIds) => updateLine(line.key, { optionIds })}
            menu={menu}
          />
        ) : (
          <span />
        )}
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
    )
  }

  const addButton = (optionIds: string[]) => (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='text-muted-foreground h-7 px-2'
      onClick={() => addLine(optionIds)}
    >
      <Plus className='me-1 h-3.5 w-3.5' />
      {t('addIngredient')}
    </Button>
  )

  return (
    <form onSubmit={save} className='space-y-5'>
      {/* Every sale */}
      <div className='space-y-2'>
        <div>
          <div className='text-sm font-medium'>{t('everySale')}</div>
          <p className='text-muted-foreground text-xs'>{t('everySaleHint')}</p>
        </div>
        {base.map((line) => renderLine(line, null))}
        {addButton([])}
      </div>

      {/* One block per group, one row of ingredients per option */}
      {menu.groups.length > 0 && (
        <div className='space-y-4'>
          <p className='text-muted-foreground text-xs'>
            {t('optionLinesHint')}
          </p>
          {menu.groups.map((group) => (
            <div key={group.id} className='space-y-2'>
              <div className='text-sm font-medium'>{group.label}</div>
              <div className='divide-y border-s ps-3'>
                {group.options.map((option) => {
                  const optionLines = byPrimary.get(option.id) ?? []
                  return (
                    <div key={option.id} className='space-y-2 py-2'>
                      <div className='flex items-center justify-between gap-2'>
                        <span
                          className={cn(
                            'text-sm',
                            optionLines.length === 0 && 'text-muted-foreground'
                          )}
                        >
                          {option.label}
                        </span>
                        {addButton([option.id])}
                      </div>
                      {optionLines.map((line) => renderLine(line, option.id))}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lines whose options are gone from the menu: kept so they can be removed */}
      {byPrimary.has('removed') && (
        <div className='space-y-2'>
          <div className='text-muted-foreground text-sm font-medium'>
            {t('removedOption')}
          </div>
          {byPrimary.get('removed')!.map((line) => renderLine(line, null))}
        </div>
      )}

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
 * Narrows an option's line to a combination: "only with Spiced". Lists the
 * options of the other groups; one pick per single-choice group.
 */
function OnlyWithPicker({
  primary,
  value,
  onChange,
  menu,
}: {
  primary: string
  value: string[]
  onChange: (optionIds: string[]) => void
  menu: MenuOptions
}) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const ownGroup = menu.byId.get(primary)?.groupIndex
  const others = menu.groups.filter((_, index) => index !== ownGroup)
  const extras = value.filter((v) => v !== primary)
  const chosen = new Set(extras)
  const removed = extras.filter((v) => !menu.byId.has(v))
  const label = extras
    .map((v) => menu.byId.get(v)?.label ?? t('removedOption'))
    .join(' + ')

  const toggle = (group: MenuGroup, optionId: string, checked: boolean) => {
    if (!checked) {
      onChange(value.filter((v) => v !== optionId))
      return
    }
    const siblings = new Set(group.options.map((o) => o.id))
    const kept = group.allowMultiple
      ? value
      : value.filter((v) => v === primary || !siblings.has(v))
    onChange([...kept, optionId])
  }

  if (others.length === 0 && removed.length === 0) return <span />

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          role='combobox'
          aria-expanded={open}
          className={cn(
            'h-8 max-w-40 px-2 text-xs font-normal',
            extras.length === 0 && 'text-muted-foreground'
          )}
        >
          <span className='truncate'>
            {extras.length > 0 ? `${t('onlyWith')} ${label}` : t('onlyWith')}
          </span>
          <ChevronsUpDown className='ms-1 h-3.5 w-3.5 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-56 space-y-3 p-3' align='end'>
        {others.map((group) => (
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
