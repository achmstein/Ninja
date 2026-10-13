import type { CatalogItemDto, ItemCustomizationDto, UserItemPreferenceDto } from '@/api/catalog'
import type { CartCustomization } from '@/lib/cart'
import {
  effectiveBasePrice,
  preferenceSelections,
  selectionsToCustomizations,
  withoutOutOfStock,
} from '@/components/menu/item-form'
import { posterTone, type MenuSectionData, type PosterTone, type SectionKind } from '@/components/menu/data/sections'

/**
 * The Ninja style's deck: one column of big cards per category, side by side.
 * A returning guest's usuals lead as a column of their own, so the deck
 * opens on "your usual"; otherwise it opens on the first category.
 */
export type DeckColumn = {
  id: string
  label: string
  kind: SectionKind
  /** The colour a card without a photo is painted in */
  tone: PosterTone
  items: CatalogItemDto[]
}

export function buildDeck(sections: MenuSectionData[]): DeckColumn[] {
  const columns: DeckColumn[] = []
  const usuals = sections.find((s) => s.kind === 'usuals')
  if (usuals && usuals.items.length > 0) {
    columns.push({ ...usuals, tone: 'primary' })
  }
  let index = 0
  for (const section of sections) {
    if (section.kind !== 'category') continue
    columns.push({ ...section, tone: posterTone(index++) })
  }
  return columns
}

/** The usual the deck opens on: the first of the usuals still on the menu, or none. */
export function pickUsual(columns: DeckColumn[]): CatalogItemDto | null {
  const usuals = columns.find((c) => c.kind === 'usuals')
  return usuals?.items.find((i) => i.isAvailable !== false) ?? null
}

/** Where an item sits in the deck, preferring its own category over the usuals. */
export function positionOf(columns: DeckColumn[], itemId: number | string | undefined): { column: number; row: number } | null {
  let fallback: { column: number; row: number } | null = null
  for (let column = 0; column < columns.length; column++) {
    const row = columns[column].items.findIndex((i) => String(i.id) === String(itemId))
    if (row < 0) continue
    if (columns[column].kind === 'category') return { column, row }
    fallback ??= { column, row }
  }
  return fallback
}

/** The options in the order the business set them. */
export function sortedOptions(customization: ItemCustomizationDto) {
  return [...(customization.options ?? [])].sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
}

/** What a dish goes in with untouched: the customer's saved way over the business's defaults, nothing sold out. */
function quickSelections(item: CatalogItemDto, preference?: UserItemPreferenceDto) {
  return withoutOutOfStock(item.customizations, preferenceSelections(item.customizations, preference))
}

/**
 * Whether a held press (or the plus) may add the item straight away: it is on, and either it has
 * nothing to choose at all or the customer has a saved way of it that still answers every required
 * choice. Anything else opens, so nobody gets a dish made a way they did not pick.
 */
export function canQuickAdd(item: CatalogItemDto, preference?: UserItemPreferenceDto): boolean {
  if (item.isAvailable === false) return false
  const customizations = item.customizations ?? []
  if (customizations.length === 0) return true
  if (!preference?.selectedOptions?.length) return false
  const selections = quickSelections(item, preference)
  return customizations.every((c) => !c.isRequired || (selections[String(c.id)]?.length ?? 0) > 0)
}

/** The line a quick add puts in: the customer's saved way (else the business's defaults), nothing sold out, one of it. */
export function quickAddChoice(item: CatalogItemDto, preference?: UserItemPreferenceDto): { customizations: CartCustomization[]; unitPrice: number } {
  const selections = quickSelections(item, preference)
  const customizations = selectionsToCustomizations(item, selections)
  return {
    customizations,
    unitPrice: effectiveBasePrice(item) + customizations.reduce((sum, c) => sum + c.priceAdjustment, 0),
  }
}

/** Which column a horizontal pager shows, from how far it has scrolled (negative in RTL). */
export function columnAt(scrollLeft: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.round(Math.abs(scrollLeft) / width)))
}

/** A two-finger pinch: closing to under this share of the start distance zooms out, opening past its inverse zooms in. */
export const PINCH_OUT = 0.78

export function pinchIntent(startDistance: number, distance: number): 'out' | 'in' | null {
  if (startDistance <= 0) return null
  const ratio = distance / startDistance
  if (ratio <= PINCH_OUT) return 'out'
  if (ratio >= 1 / PINCH_OUT) return 'in'
  return null
}

export const TONE_CLASS: Record<PosterTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  deep: 'poster-deep',
}

/** The corner a card wears in the deck; the detail it opens into has none */
export const CARD_RADIUS = 28
