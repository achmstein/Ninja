import {
  type MenuImportRequest,
  type MenuProposal,
  type ProposedChoice,
} from '@/api/catalog'
import { toNumber } from '@/lib/money'
import {
  fromLocalizedValue,
  isBlank,
  type LocalizedValue,
  toLocalizedValue,
} from '@/components/localized-input'

/** Where a proposed section's items go: an existing category's id, or a new one */
export const NEW_CATEGORY = 'new'

/** One printed choice of an item (Small 30), as the review sheet edits it */
export type ReviewChoiceOption = {
  key: number
  name: LocalizedValue
  price: string
}

/** An item's printed choices: "Size" and its options, each with its full price */
export type ReviewChoice = {
  name: LocalizedValue
  options: ReviewChoiceOption[]
}

/**
 * A proposed item as the review sheet edits it: ticked or not, names and
 * price as strings the way the item form keeps them, and its choices when
 * the menu printed several prices (the item's price is then the cheapest).
 */
export type ReviewItem = {
  key: number
  rawText: string
  include: boolean
  name: LocalizedValue
  description: LocalizedValue
  price: string
  choice: ReviewChoice | null
  existingItemId: number | null
}

/** A proposed section: its items and where they go, an existing category's id or `NEW_CATEGORY` */
export type ReviewCategory = {
  key: number
  name: LocalizedValue
  catalogTypeId: string
  items: ReviewItem[]
}

let nextKey = 1

function toReviewChoice(choice: ProposedChoice | null | undefined) {
  if (!choice || choice.options.length < 2) return null
  return {
    name: toLocalizedValue(choice.name),
    options: choice.options.map((option) => ({
      key: nextKey++,
      name: toLocalizedValue(option.name),
      price: String(toNumber(option.price)),
    })),
  }
}

export function toReviewCategories(proposal: MenuProposal): ReviewCategory[] {
  return proposal.categories.map((category) => ({
    key: nextKey++,
    name: toLocalizedValue(category.name),
    catalogTypeId:
      category.catalogTypeId != null
        ? String(category.catalogTypeId)
        : NEW_CATEGORY,
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
        choice: toReviewChoice(item.choice),
        existingItemId,
      }
    }),
  }))
}

const isPrice = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

/** The price an item is saved at: the cheapest choice when it has choices */
export function reviewItemPrice(item: ReviewItem): number | null {
  if (item.choice) {
    const prices = item.choice.options.map((o) => o.price)
    return prices.every(isPrice) ? Math.min(...prices.map(Number)) : null
  }
  return isPrice(item.price) ? Number(item.price) : null
}

/** A name (in either language) and a price, and, with choices, each one named and priced */
export function isReviewItemReady(item: ReviewItem): boolean {
  if (isBlank(item.name) || reviewItemPrice(item) == null) return false
  if (!item.choice) return true
  return (
    !isBlank(item.choice.name) &&
    item.choice.options.length >= 2 &&
    item.choice.options.every((o) => !isBlank(o.name))
  )
}

/** A ticked item is going somewhere: an existing category, or a new one with a name */
export function isReviewCategoryReady(category: ReviewCategory): boolean {
  return category.catalogTypeId !== NEW_CATEGORY || !isBlank(category.name)
}

/** The ticked items as one import: every section that keeps an item, in order */
export function toImportRequest(sections: ReviewCategory[]): MenuImportRequest {
  return {
    categories: sections
      .map((section) => ({
        section,
        items: section.items.filter((item) => item.include),
      }))
      .filter(({ items }) => items.length > 0)
      .map(({ section, items }) => ({
        catalogTypeId:
          section.catalogTypeId === NEW_CATEGORY
            ? null
            : Number(section.catalogTypeId),
        name:
          section.catalogTypeId === NEW_CATEGORY
            ? fromLocalizedValue(section.name)
            : null,
        items: items.map((item) => ({
          name: fromLocalizedValue(item.name),
          description: fromLocalizedValue(item.description),
          price: reviewItemPrice(item) ?? 0,
          choice: item.choice
            ? {
                name: fromLocalizedValue(item.choice.name),
                options: item.choice.options.map((option) => ({
                  name: fromLocalizedValue(option.name),
                  price: Number(option.price),
                })),
              }
            : null,
        })),
      })),
  }
}
