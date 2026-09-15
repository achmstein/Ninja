import { type CatalogItemDto } from '@/api/catalog'
import {
  type MenuItemToTrack,
  type RecipesProposal,
  type StockItemView,
} from '@/api/inventory'
import { toNumber } from '@/lib/money'
import { type LocalizedValue } from '@/components/localized-input'

/** Menu items per assistant call; a longer list goes up in batches */
export const PROPOSE_BATCH = 30

/** A menu item as the proposer wants it: names, options, price; Inventory keeps no copy of the menu */
export function toMenuItemToTrack(item: CatalogItemDto): MenuItemToTrack {
  return {
    catalogItemId: toNumber(item.id),
    name: { en: item.name?.en ?? '', ar: item.name?.ar ?? null },
    description: item.description
      ? { en: item.description.en ?? '', ar: item.description.ar ?? null }
      : null,
    category: item.catalogTypeName?.en ?? null,
    price: toNumber(item.price),
    options: (item.customizations ?? []).flatMap((group) =>
      (group.options ?? []).map((option) => ({
        id: toNumber(option.id),
        group: group.name?.en ?? '',
        name: { en: option.name?.en ?? '', ar: option.name?.ar ?? null },
      }))
    ),
  }
}

/** A proposed ingredient as the review sheet edits it */
export type ReviewIngredient = {
  key: string
  name: LocalizedValue
  unit: string
  packSize: string
  packName: string
  autoSoldOut: boolean
  /** Filled once created, so a retry after a failure never creates it twice */
  createdId: number | null
}

export type ReviewLine = {
  key: number
  /** A shelf item id, or "new:<key>" for a proposed ingredient */
  ingredient: string | null
  quantity: string
  optionIds: string[]
}

export type ReviewRecipe = {
  catalogItemId: number
  include: boolean
  kind: 'unit' | 'recipe'
  lines: ReviewLine[]
  warnings: string[]
  /** True once the recipe was set (or the item tracked by unit) */
  done: boolean
}

export const NEW_PREFIX = 'new:'

let nextKey = 1
export const newLineKey = () => nextKey++

/** Several batches' answers become one review: ingredients merged by key, recipes in menu order */
export function toReview(proposals: RecipesProposal[]): {
  ingredients: ReviewIngredient[]
  recipes: ReviewRecipe[]
  warnings: string[]
} {
  const ingredients = new Map<string, ReviewIngredient>()
  const recipes: ReviewRecipe[] = []
  const warnings: string[] = []
  for (const proposal of proposals) {
    warnings.push(...proposal.warnings)
    if (proposal.notes) warnings.push(proposal.notes)
    for (const item of proposal.newItems) {
      if (ingredients.has(item.key)) continue
      ingredients.set(item.key, {
        key: item.key,
        name: { en: item.name.en ?? '', ar: item.name.ar ?? '' },
        unit: item.unit,
        packSize: item.packSize != null ? String(toNumber(item.packSize)) : '',
        packName: item.packName ?? '',
        autoSoldOut: item.autoSoldOut,
        createdId: null,
      })
    }
    for (const recipe of proposal.recipes) {
      const usable = recipe.kind === 'unit' || recipe.lines.length > 0
      recipes.push({
        catalogItemId: toNumber(recipe.catalogItemId),
        include: usable,
        kind: recipe.kind === 'unit' ? 'unit' : 'recipe',
        lines: recipe.lines.map((line) => ({
          key: newLineKey(),
          ingredient:
            line.stockItemId != null
              ? String(toNumber(line.stockItemId))
              : line.newItemKey
                ? NEW_PREFIX + line.newItemKey
                : null,
          quantity: String(toNumber(line.quantity)),
          optionIds: line.optionIds.map((id) => String(toNumber(id))),
        })),
        warnings: recipe.warnings,
        done: false,
      })
    }
  }
  return { ingredients: [...ingredients.values()], recipes, warnings }
}

/** The ingredient keys the included recipes still need created */
export function neededIngredients(
  recipes: ReviewRecipe[],
  ingredients: ReviewIngredient[]
): ReviewIngredient[] {
  const needed = new Set<string>()
  for (const recipe of recipes) {
    if (!recipe.include || recipe.kind !== 'recipe') continue
    for (const line of recipe.lines) {
      if (line.ingredient?.startsWith(NEW_PREFIX)) {
        needed.add(line.ingredient.slice(NEW_PREFIX.length))
      }
    }
  }
  return ingredients.filter((i) => needed.has(i.key))
}

/** A recipe is ready when it is a unit, or every line has an ingredient and a quantity */
export function isRecipeReady(recipe: ReviewRecipe): boolean {
  if (recipe.kind === 'unit') return true
  return (
    recipe.lines.length > 0 &&
    recipe.lines.every(
      (line) => line.ingredient !== null && parseFloat(line.quantity) > 0
    )
  )
}

/** The unit a line's quantity is in, from the shelf or the proposed ingredient */
export function lineUnit(
  ingredient: string | null,
  shelf: Map<string, StockItemView>,
  proposed: Map<string, ReviewIngredient>
): string {
  if (!ingredient) return ''
  if (ingredient.startsWith(NEW_PREFIX)) {
    return proposed.get(ingredient.slice(NEW_PREFIX.length))?.unit ?? ''
  }
  return shelf.get(ingredient)?.unit ?? ''
}
