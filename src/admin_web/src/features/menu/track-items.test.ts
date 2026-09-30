import { describe, expect, it } from 'vitest'
import { type RecipesProposal } from '@/api/inventory'
import { NEW_PREFIX, toReview } from './track-items'

const ingredient = (key: string, en: string, ar: string) => ({
  key,
  name: { en, ar },
  unit: 'ml',
  packSize: null,
  packName: null,
  autoSoldOut: false,
})

const recipe = (catalogItemId: number, newItemKey: string) => ({
  catalogItemId,
  kind: 'recipe',
  lines: [
    { stockItemId: null, newItemKey, quantity: 200, optionIds: [], slot: 0 },
  ],
  warnings: [],
})

describe('toReview', () => {
  it('makes one ingredient of the same thing proposed by two batches under different keys', () => {
    const first: RecipesProposal = {
      newItems: [ingredient('whole-milk', 'Whole Milk', 'حليب كامل')],
      recipes: [recipe(1, 'whole-milk')],
      warnings: [],
      notes: null,
    }
    const second: RecipesProposal = {
      newItems: [ingredient('milk', ' whole  milk', '')],
      recipes: [recipe(2, 'milk')],
      warnings: [],
      notes: null,
    }

    const review = toReview([first, second], [])

    expect(review.ingredients.map((i) => i.key)).toEqual(['whole-milk'])
    const second_ = review.recipes.find((r) => r.catalogItemId === 2)!
    expect(second_.draft.slots[0].stockItemId).toBe(NEW_PREFIX + 'whole-milk')
  })

  it('keeps different ingredients apart', () => {
    const proposal: RecipesProposal = {
      newItems: [
        ingredient('milk', 'Whole Milk', ''),
        ingredient('oat', 'Oat Milk', ''),
      ],
      recipes: [recipe(1, 'milk'), recipe(2, 'oat')],
      warnings: [],
      notes: null,
    }

    expect(toReview([proposal], []).ingredients).toHaveLength(2)
  })
})
