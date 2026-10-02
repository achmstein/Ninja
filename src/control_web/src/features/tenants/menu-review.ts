// The menu read while a business is created, as its review holds it and as
// Catalog's import takes it (POST /api/catalog/menu/import). No catalog yet,
// so every section goes in as a new category.

import type { LocalizedText, MenuProposal, ProposedChoice } from '@/api/control'

export type DropItem = {
  key: string
  name: LocalizedText
  description: LocalizedText
  /** The price to save: the smallest of a choice's, or the item's own */
  price: string
  choice: ProposedChoice | null
  include: boolean
}

export type DropCategory = { key: string; name: LocalizedText; items: DropItem[] }

/** A name in whichever language it was read in, English first */
export const menuText = (value: LocalizedText | null | undefined) => value?.en?.trim() || value?.ar?.trim() || ''
const text = menuText

/** The proposal as the review holds it: every item ticked, every section a new category */
export function fromProposal(proposal: MenuProposal): DropCategory[] {
  return proposal.categories.map((category, c) => ({
    key: `c${c}`,
    name: category.name,
    items: category.items.map((item, i) => ({
      key: `c${c}i${i}`,
      name: item.name,
      description: item.description,
      price: String(item.price),
      choice: item.choice ?? null,
      include: true,
    })),
  }))
}

/** The ticked items in Catalog's import shape (POST /api/catalog/menu/import): every section a new category */
export function toImportRequest(categories: DropCategory[]): { [key: string]: unknown } {
  return {
    categories: categories
      .map((category) => ({ category, items: category.items.filter((item) => item.include && text(item.name)) }))
      .filter(({ items }) => items.length > 0)
      .map(({ category, items }) => ({
        catalogTypeId: null,
        name: category.name,
        items: items.map((item) => ({
          name: item.name,
          description: text(item.description) ? item.description : null,
          price: Number(item.price) || 0,
          choice: item.choice
            ? {
                name: item.choice.name,
                options: item.choice.options.map((o) => ({ name: o.name, price: Number(o.price) })),
              }
            : null,
        })),
      })),
  }
}

export const includedCount = (categories: DropCategory[] | null) =>
  categories?.reduce((n, c) => n + c.items.filter((i) => i.include).length, 0) ?? 0
