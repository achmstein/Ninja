import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  CookingPot,
  Info,
  Package,
  Sparkles,
  X,
} from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import {
  type RecipesProposal,
  type RecipeView,
  type StockItemView,
} from '@/api/inventory'
import {
  getRecipeCostsOptions,
  getRecipesOptions,
  proposeRecipesMutation,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { assistErrorMessage, useAssistStore } from '@/features/assist/errors'
import { formatQuantity } from '@/features/inventory/format'
import { stockItemsQueryOptions } from '@/features/inventory/queries'
import {
  choiceDeltas,
  standardBreakdown,
  standardChoiceNames,
  standardCost,
} from '@/features/inventory/recipe-cost'
import {
  draftLines,
  fromApi,
  toApi,
  validateDraft,
  type RecipeDraft,
} from '@/features/inventory/recipe-model'
import { isUnitRecipe } from '@/features/inventory/stock-rules'
import { useInventoryActions } from '@/features/inventory/use-inventory-actions'
import { menuOptionsOf, type MenuOptions } from '../menu-options'
import { toMenuItemToTrack } from '../track-items'
import { RecipeBuilder } from './recipe-builder'
import {
  DeductionPreview,
  type IngredientOption,
  type StockInfo,
} from './recipe-editor'
import { RecipeReviewSheet } from './recipe-review-sheet'
import { RecipeSummary } from './recipe-summary'

type StockRuleSectionProps = {
  item: CatalogItemDto
}

/**
 * What one sale of this item takes out of stock. Three states: not
 * tracked; sold as a unit (a stock item of its own, one per sale); or a
 * recipe of slots — the coffee, the sugar, the cup — each with a default
 * and what the customer's choices make of it. Shown
 * as rows, edited in place, with a preview that picks options the way the
 * cashier does and shows what would be deducted, and the cost of a sale
 * against the price.
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
  const stock = useMemo(
    () =>
      new Map<string, StockInfo>(
        (stockItems.data ?? []).map((i) => [
          String(i.id),
          { label: localized(i.name), unit: i.unit ?? '' },
        ])
      ),
    [stockItems.data, localized]
  )

  const queryClient = useQueryClient()

  // "Propose": the assistant fills the whole recipe for this one item; the
  // review sheet (the same one "Track items" uses) shows it before anything is saved
  const assistAvailable = useAssistStore((s) => !s.unavailable)
  const propose = useMutation(proposeRecipesMutation())
  const [proposal, setProposal] = useState<RecipesProposal | null>(null)
  const askAssistant = async () => {
    try {
      setProposal(
        await propose.mutateAsync({
          body: { items: [toMenuItemToTrack(item)] },
          query: { 'api-version': API_VERSION },
        })
      )
    } catch (error) {
      toast.error(assistErrorMessage(error))
    }
  }
  const closeProposal = () => {
    setProposal(null)
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRecipes' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRecipeCosts' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getStockItems' }] })
  }
  const proposeButton = assistAvailable && (
    <Button
      type='button'
      variant='outline'
      size='sm'
      className='text-primary'
      disabled={propose.isPending}
      onClick={askAssistant}
    >
      {propose.isPending ? (
        <Spinner className='me-2' />
      ) : (
        <Sparkles className='me-2 h-4 w-4' />
      )}
      {t('proposeRecipe')}
    </Button>
  )
  const reviewSheet = proposal && (
    <RecipeReviewSheet
      proposals={[proposal]}
      items={[item]}
      shelf={stockItems.data ?? []}
      onOpenChange={(open) => !open && closeProposal()}
      onBack={() => setProposal(null)}
    />
  )

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
      <RecipeEditorForm
        catalogItemId={catalogItemId}
        menu={menu}
        recipe={unitLine ? undefined : recipe}
        stockItems={stockItems.data ?? []}
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
          {proposeButton}
        </div>
        {reviewSheet}
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
        <>
          <RecipeSummary recipe={recipe} menu={menu} stock={stock} />
          <DeductionPreview lines={recipe.lines} menu={menu} stock={stock} />
        </>
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
        {proposeButton}
      </div>
      {reviewSheet}

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

/** The slots editor with save and cancel, and the preview over the draft as it is being typed */
function RecipeEditorForm({
  catalogItemId,
  menu,
  recipe,
  stockItems,
  onDone,
}: {
  catalogItemId: number
  menu: MenuOptions
  recipe: RecipeView | undefined
  stockItems: StockItemView[]
  onDone: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const { setRecipe, isPending } = useInventoryActions()

  const ingredients: IngredientOption[] = stockItems.map((i) => ({
    value: String(i.id),
    label: localized(i.name),
    unit: i.unit ?? '',
    names: [i.name?.en, i.name?.ar].filter(
      (n): n is string => !!n && n.trim() !== ''
    ),
  }))
  const stock = new Map<string, StockInfo>(
    ingredients.map((i) => [i.value, { label: i.label, unit: i.unit }])
  )

  const [draft, setDraft] = useState<RecipeDraft>(() =>
    fromApi(
      recipe,
      (optionId) => {
        const option = menu.byId.get(optionId)
        return option ? menu.groups[option.groupIndex]?.id : undefined
      },
      menu.groups.map((g) => g.id)
    )
  )

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateDraft(draft)
    if (problem) {
      toast.error(t(problem))
      return
    }
    try {
      await setRecipe(catalogItemId, toApi(draft))
      onDone()
    } catch {
      // toasted by useInventoryActions
    }
  }

  const preview = draftLines(draft)

  return (
    <form onSubmit={save} className='space-y-4'>
      <RecipeBuilder
        draft={draft}
        onChange={setDraft}
        menu={menu}
        ingredients={ingredients}
      />

      <DeductionPreview lines={preview} menu={menu} stock={stock} />

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
 * What one sale costs at the active branch against the item's price, for
 * the standard choice (the default of each option group), then what every
 * other choice adds — resolved the way the till resolves it. Inventory
 * prices nothing; the join with Catalog's price and defaults happens here.
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
  // The ingredients priced at nothing, by name, so the owner knows what to receive
  const uncostedNames = Array.from(
    new Set(
      cost.uncosted.map((id) =>
        localized(
          cost.lines.find((l) => toNumber(l.stockItemId) === toNumber(id))?.name
        )
      )
    )
  ).filter(Boolean)
  const choices = standardChoiceNames(item, localized)
  const breakdown = standardBreakdown(cost, item)
  const groups = choiceDeltas(cost, item)
  const perUnit = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 3 })

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

      {/* How the figure adds up: what the standard choice takes, priced line by line */}
      {breakdown.length > 0 && (
        <div className='border-t px-3 py-1.5 text-xs'>
          <div className='text-muted-foreground mb-0.5'>
            {t('howCostAddsUp')}
          </div>
          <ul className='space-y-0.5'>
            {breakdown.map((line) => (
              <li
                key={line.stockItemId}
                className='flex items-baseline justify-between gap-3'
              >
                <span className='min-w-0 truncate'>
                  {localized(line.name)}
                  <span className='text-muted-foreground'>
                    {' · '}
                    {formatQuantity(line.quantity, line.unit, t)}
                  </span>
                </span>
                {line.uncosted ? (
                  <span className='text-warning shrink-0'>
                    {t('countsAsFree')}
                  </span>
                ) : (
                  <span className='text-muted-foreground shrink-0 tabular-nums'>
                    × {perUnit(line.unitCost)} ={' '}
                    <span className='text-foreground'>
                      {formatEgp(line.cost)}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {incomplete && (
        <div className='text-warning flex items-start gap-1.5 border-t px-3 py-1.5 text-xs'>
          <AlertTriangle className='mt-0.5 size-3 shrink-0' aria-hidden />
          <span className='min-w-0 flex-1'>
            {t('costIncompleteHint', { count: cost.uncosted.length })}
          </span>
          {uncostedNames.length > 0 && (
            // The names behind an icon: the drawer is crowded enough
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type='button'
                  className='hover:bg-warning/10 -m-1 shrink-0 rounded p-1'
                  aria-label={t('costIncomplete', {
                    count: uncostedNames.length,
                  })}
                >
                  <Info className='size-3.5' aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align='end' className='w-64 p-3 text-sm'>
                <div className='text-muted-foreground mb-1.5 text-xs'>
                  {t('costIncomplete', { count: uncostedNames.length })}
                </div>
                <ul className='space-y-1'>
                  {uncostedNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
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
