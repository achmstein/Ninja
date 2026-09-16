import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Sparkles } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { type CatalogItemDto } from '@/api/catalog'
import { type RecipesProposal, type StockItemView } from '@/api/inventory'
import {
  createStockItemMutation,
  setRecipeMutation,
  trackByUnitMutation,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { InfoTip } from '@/components/info-tip'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
} from '@/components/localized-input'
import { unitLabel } from '@/features/inventory/format'
import { toApi } from '@/features/inventory/recipe-model'
import { menuOptionsOf } from '../menu-options'
import {
  isRecipeReady,
  neededIngredients,
  NEW_PREFIX,
  toReview,
  withCreatedIds,
  type ReviewIngredient,
  type ReviewRecipe,
} from '../track-items'
import { RecipeBuilder } from './recipe-builder'
import { type IngredientOption } from './recipe-editor'

type RecipeReviewSheetProps = {
  proposals: RecipesProposal[]
  /** The menu items that were asked about, for names and options */
  items: CatalogItemDto[]
  shelf: StockItemView[]
  onOpenChange: (open: boolean) => void
  onBack: () => void
}

const UNITS = ['g', 'ml', 'pcs']

/**
 * What the assistant proposed for the picked menu items, for checking
 * before anything is saved: the ingredients the shelf is missing (edit,
 * untick), then one rule per item — sold as a unit, or a recipe in the
 * same slots editor the item sheet uses. Confirming creates the needed
 * ingredients, then sets each recipe (or tracks the item by unit); a
 * failure leaves the sheet open with what was done remembered, so a retry
 * never repeats it.
 */
export function RecipeReviewSheet({
  proposals,
  items,
  shelf,
  onOpenChange,
  onBack,
}: RecipeReviewSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const createItem = useMutation(createStockItemMutation())
  const setRecipe = useMutation(setRecipeMutation())
  const trackByUnit = useMutation(trackByUnitMutation())

  const [review, setReview] = useState(() => toReview(proposals, items))
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(
    null
  )

  const itemById = useMemo(
    () => new Map(items.map((item) => [toNumber(item.id), item])),
    [items]
  )

  const updateIngredient = (key: string, patch: Partial<ReviewIngredient>) =>
    setReview((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.key === key ? { ...i, ...patch } : i
      ),
    }))
  const updateRecipe = (catalogItemId: number, patch: Partial<ReviewRecipe>) =>
    setReview((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) =>
        r.catalogItemId === catalogItemId ? { ...r, ...patch } : r
      ),
    }))

  // Pickers: the shelf, then the proposed ingredients as "new" entries
  const ingredients: IngredientOption[] = useMemo(
    () => [
      ...shelf.map((item) => ({
        value: String(item.id),
        label: localized(item.name),
        unit: item.unit ?? '',
        names: [item.name?.en, item.name?.ar].filter(
          (n): n is string => !!n && n.trim() !== ''
        ),
      })),
      ...review.ingredients.map((i) => ({
        value: NEW_PREFIX + i.key,
        label: `${t('newIngredient')}: ${i.name.en || i.name.ar || i.key}`,
        unit: i.unit,
        names: [i.name.en, i.name.ar].filter((n) => n.trim() !== ''),
      })),
    ],
    [shelf, review.ingredients, localized, t]
  )

  const included = review.recipes.filter((r) => r.include && !r.done)
  const needed = neededIngredients(review.recipes, review.ingredients)
  const total =
    included.length + needed.filter((i) => i.createdId == null).length

  const confirm = async () => {
    if (included.length === 0) {
      toast.error(t('noItemsSelected'))
      return
    }
    if (!included.every(isRecipeReady)) {
      toast.error(t('recipeNeedsLines'))
      return
    }
    if (needed.some((i) => !i.name.en.trim())) {
      toast.error(t('ingredientNeedsName'))
      return
    }

    let done = 0
    setSaving({ done, total })
    const createdIds = new Map<string, number>(
      review.ingredients
        .filter((i) => i.createdId != null)
        .map((i) => [i.key, i.createdId!])
    )
    try {
      // 1. The ingredients the included recipes need, once each
      for (const ingredient of needed) {
        if (createdIds.has(ingredient.key)) continue
        const created = await createItem.mutateAsync({
          body: {
            name: fromLocalizedValue(ingredient.name),
            unit: ingredient.unit,
            packSize:
              parseFloat(ingredient.packSize) > 0
                ? parseFloat(ingredient.packSize)
                : null,
            packName: ingredient.packName.trim() || null,
            autoSoldOut: ingredient.autoSoldOut,
          },
          headers: { 'x-requestid': uuidv4() },
          query: { 'api-version': API_VERSION },
        })
        createdIds.set(ingredient.key, toNumber(created.id))
        updateIngredient(ingredient.key, { createdId: toNumber(created.id) })
        setSaving({ done: ++done, total })
      }

      // 2. One rule per item
      for (const recipe of included) {
        const item = itemById.get(recipe.catalogItemId)
        if (recipe.kind === 'unit') {
          await trackByUnit.mutateAsync({
            body: {
              catalogItemId: recipe.catalogItemId,
              name: { en: item?.name?.en ?? '', ar: item?.name?.ar ?? null },
            },
            headers: { 'x-requestid': uuidv4() },
            query: { 'api-version': API_VERSION },
          })
        } else {
          await setRecipe.mutateAsync({
            path: { catalogItemId: recipe.catalogItemId },
            body: toApi(withCreatedIds(recipe.draft, createdIds)),
            query: { 'api-version': API_VERSION },
          })
        }
        updateRecipe(recipe.catalogItemId, { done: true })
        setSaving({ done: ++done, total })
      }
    } catch {
      toast.error(t('failedToTrack'))
      setSaving(null)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getRecipes' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getStockItems' }] })
      return
    }

    setSaving(null)
    toast.success(t('itemsTracked', { count: included.length }))
    onOpenChange(false)
  }

  return (
    <Sheet open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-3xl'>
        <SheetHeader className='border-b'>
          <SheetTitle className='flex items-center gap-2'>
            <Sparkles className='text-primary size-4' aria-hidden />
            {t('reviewRecipes')}
          </SheetTitle>
        </SheetHeader>

        <LocalizedFields>
          <div className='space-y-5 p-4'>
            {review.warnings.length > 0 && (
              <Alert>
                <AlertTriangle />
                <AlertTitle>{t('toastWarning')}</AlertTitle>
                <AlertDescription>
                  <ul className='list-disc ps-4'>
                    {review.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {review.ingredients.length > 0 && (
              <section className='space-y-2'>
                <h3 className='flex items-center gap-1 text-sm font-medium'>
                  {t('newIngredients')}
                  <InfoTip>{t('newIngredientsHint')}</InfoTip>
                </h3>
                <div className='divide-y rounded-lg border'>
                  {review.ingredients.map((ingredient) => {
                    const used = needed.some((n) => n.key === ingredient.key)
                    return (
                      <div
                        key={ingredient.key}
                        className={cn(
                          'grid gap-2 p-3 sm:grid-cols-[minmax(0,2fr)_5rem_5rem_minmax(0,1fr)_auto] sm:items-end',
                          !used && 'opacity-60'
                        )}
                      >
                        <LocalizedInput
                          ariaLabel={t('stockItemName')}
                          value={ingredient.name}
                          onChange={(name) =>
                            updateIngredient(ingredient.key, { name })
                          }
                          compact
                        />
                        <Select
                          value={ingredient.unit}
                          onValueChange={(unit) =>
                            updateIngredient(ingredient.key, { unit })
                          }
                        >
                          <SelectTrigger className='h-8' aria-label={t('unit')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {unitLabel(u, t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type='number'
                          min='0'
                          step='any'
                          className='h-8'
                          placeholder={t('packSize')}
                          aria-label={t('packSize')}
                          value={ingredient.packSize}
                          onChange={(e) =>
                            updateIngredient(ingredient.key, {
                              packSize: e.target.value,
                            })
                          }
                        />
                        <Input
                          className='h-8'
                          placeholder={t('packName')}
                          aria-label={t('packName')}
                          value={ingredient.packName}
                          onChange={(e) =>
                            updateIngredient(ingredient.key, {
                              packName: e.target.value,
                            })
                          }
                        />
                        <div className='flex items-center gap-2'>
                          {ingredient.createdId != null ? (
                            <Badge variant='secondary' className='gap-1'>
                              <Check className='size-3' /> {t('created')}
                            </Badge>
                          ) : (
                            <label className='flex items-center gap-1.5 text-xs'>
                              <Checkbox
                                checked={ingredient.autoSoldOut}
                                onCheckedChange={(on) =>
                                  updateIngredient(ingredient.key, {
                                    autoSoldOut: on === true,
                                  })
                                }
                              />
                              {t('autoSoldOutShort')}
                            </label>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className='space-y-2'>
              <h3 className='text-sm font-medium'>{t('menuItems')}</h3>
              <div className='space-y-3'>
                {review.recipes.map((recipe) => {
                  const item = itemById.get(recipe.catalogItemId)
                  const menu = item
                    ? menuOptionsOf(item, localized)
                    : { groups: [], byId: new Map() }
                  return (
                    <div
                      key={recipe.catalogItemId}
                      className={cn(
                        'rounded-lg border',
                        !recipe.include && 'opacity-60',
                        recipe.done && 'border-success/50'
                      )}
                    >
                      <div className='flex flex-wrap items-center gap-2 border-b px-3 py-2'>
                        <Checkbox
                          checked={recipe.include}
                          disabled={recipe.done}
                          onCheckedChange={(on) =>
                            updateRecipe(recipe.catalogItemId, {
                              include: on === true,
                            })
                          }
                          aria-label={t('includeItem')}
                        />
                        <span className='min-w-0 flex-1 truncate font-medium'>
                          {localized(item?.name) || `#${recipe.catalogItemId}`}
                        </span>
                        {recipe.done ? (
                          <Badge variant='secondary' className='gap-1'>
                            <Check className='size-3' /> {t('tracked')}
                          </Badge>
                        ) : (
                          <ToggleGroup
                            type='single'
                            size='sm'
                            value={recipe.kind}
                            onValueChange={(kind) =>
                              kind &&
                              updateRecipe(recipe.catalogItemId, {
                                kind: kind as 'unit' | 'recipe',
                              })
                            }
                          >
                            <ToggleGroupItem
                              value='unit'
                              className='h-7 px-2 text-xs'
                            >
                              {t('sellAsUnit')}
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value='recipe'
                              className='h-7 px-2 text-xs'
                            >
                              {t('usesIngredients')}
                            </ToggleGroupItem>
                          </ToggleGroup>
                        )}
                      </div>

                      {recipe.warnings.length > 0 && (
                        <ul className='text-warning list-disc px-3 py-1.5 ps-8 text-xs'>
                          {recipe.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      )}

                      {recipe.kind === 'unit' ? (
                        <p className='text-muted-foreground px-3 py-2 text-sm'>
                          {t('sellAsUnitExplained', {
                            name: localized(item?.name),
                          })}
                        </p>
                      ) : recipe.done ? null : (
                        <div className='px-3 py-2'>
                          <RecipeBuilder
                            draft={recipe.draft}
                            onChange={(draft) =>
                              updateRecipe(recipe.catalogItemId, { draft })
                            }
                            menu={menu}
                            ingredients={ingredients}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </LocalizedFields>

        <SheetFooter className='border-t'>
          <div className='flex w-full flex-wrap items-center justify-between gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={!!saving}
              onClick={onBack}
            >
              <ArrowLeft className='me-1 h-4 w-4 rtl:rotate-180' /> {t('back')}
            </Button>
            <div className='flex items-center gap-3'>
              {saving && (
                <span className='text-muted-foreground text-sm tabular-nums'>
                  {t('creatingItems', {
                    done: saving.done,
                    total: saving.total,
                  })}
                </span>
              )}
              <Button
                type='button'
                disabled={!!saving || included.length === 0}
                onClick={confirm}
              >
                {saving ? (
                  <Spinner className='me-2' />
                ) : (
                  <Check className='me-2 h-4 w-4' />
                )}
                {t('trackCount', { count: included.length })}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
