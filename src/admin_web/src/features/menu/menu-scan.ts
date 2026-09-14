import { type MenuProposal } from '@/api/catalog'
import { toNumber } from '@/lib/money'
import {
  type LocalizedValue,
  toLocalizedValue,
} from '@/components/localized-input'

/** Where a proposed section's items go: an existing category's id, or a new one */
export const NEW_CATEGORY = 'new'

/**
 * A proposed item as the review sheet edits it: ticked or not, names and
 * price as strings the way the item form keeps them. `createdId` is filled
 * once the item exists, so a retry after a failure never creates it twice.
 */
export type ReviewItem = {
  key: number
  rawText: string
  include: boolean
  name: LocalizedValue
  description: LocalizedValue
  price: string
  existingItemId: number | null
  createdId: number | null
}

/**
 * A proposed section: its items and where they go. `catalogTypeId` is an
 * existing category's id or `NEW_CATEGORY`; `createdId` the new category's
 * id once it exists.
 */
export type ReviewCategory = {
  key: number
  name: LocalizedValue
  catalogTypeId: string
  items: ReviewItem[]
  createdId: number | null
}

let nextKey = 1

export function toReviewCategories(proposal: MenuProposal): ReviewCategory[] {
  return proposal.categories.map((category) => ({
    key: nextKey++,
    name: toLocalizedValue(category.name),
    catalogTypeId:
      category.catalogTypeId != null
        ? String(category.catalogTypeId)
        : NEW_CATEGORY,
    createdId: null,
    items: category.items.map((item) => {
      const price = toNumber(item.price)
      const existingItemId =
        item.existingItemId != null ? toNumber(item.existingItemId) : null
      return {
        key: nextKey++,
        rawText: item.rawText,
        // What is already on the menu starts unticked
        include: existingItemId == null,
        name: toLocalizedValue(item.name),
        description: toLocalizedValue(item.description),
        price: price > 0 ? String(price) : '',
        existingItemId,
        createdId: null,
      }
    }),
  }))
}

/** An English name and a price: what the item endpoint needs */
export function isReviewItemReady(item: ReviewItem): boolean {
  return item.name.en.trim() !== '' && parseFloat(item.price) >= 0
}

/** A ticked item is going somewhere: an existing category, or a new one with an English name */
export function isReviewCategoryReady(category: ReviewCategory): boolean {
  return (
    category.catalogTypeId !== NEW_CATEGORY || category.name.en.trim() !== ''
  )
}
