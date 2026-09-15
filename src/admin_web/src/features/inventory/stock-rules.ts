import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type RecipeCostView, type RecipeView } from '@/api/inventory'
import {
  getRecipeCostsOptions,
  getRecipesOptions,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { toNumber } from '@/lib/money'
import { DEFAULT_FOOD_COST_TARGET } from './menu-cost-rows'

/** How a menu item is tracked: a stock item of its own, or a recipe of ingredients */
export type StockRuleKind = 'unit' | 'recipe'

/** One base line of exactly one piece is the "sell as a unit" shortcut's shape */
export function isUnitRecipe(recipe: RecipeView): boolean {
  return (
    recipe.lines.length === 1 &&
    toNumber(recipe.lines[0].quantity) === 1 &&
    recipe.lines[0].optionIds.length === 0 &&
    recipe.lines[0].unit === 'pcs'
  )
}

/** What the menu list shows beside a tracked item */
export type StockRuleBadge = {
  kind: StockRuleKind
  /** cost ÷ price as a whole percent; null without a price or costs */
  foodCost: number | null
  /** Ingredients never received at the branch: the food cost is a lower bound */
  incomplete: boolean
  overTarget: boolean
}

/**
 * The stock rule and food cost of every tracked menu item at the active
 * branch, keyed by catalog item id, for the menu list's badges. Recipes
 * are global, costs follow X-Branch-Id.
 */
export function useStockRuleBadges(
  prices: Map<number, number>
): Map<number, StockRuleBadge> {
  const recipes = useQuery(
    getRecipesOptions({ query: { 'api-version': API_VERSION } })
  )
  const costs = useQuery(
    getRecipeCostsOptions({ query: { 'api-version': API_VERSION } })
  )
  return useMemo(() => {
    const costById = new Map<number, RecipeCostView>(
      (costs.data ?? []).map((c) => [toNumber(c.catalogItemId), c])
    )
    const badges = new Map<number, StockRuleBadge>()
    for (const recipe of recipes.data ?? []) {
      const id = toNumber(recipe.catalogItemId)
      const cost = costById.get(id)
      const price = prices.get(id) ?? 0
      const foodCost =
        cost && price > 0
          ? Math.round((toNumber(cost.baseCost) / price) * 100)
          : null
      badges.set(id, {
        kind: isUnitRecipe(recipe) ? 'unit' : 'recipe',
        foodCost,
        incomplete: (cost?.uncosted.length ?? 0) > 0,
        overTarget: foodCost !== null && foodCost > DEFAULT_FOOD_COST_TARGET,
      })
    }
    return badges
  }, [recipes.data, costs.data, prices])
}
