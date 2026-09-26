import type { CatalogItemDto, ItemCustomizationDto } from '@/api/catalog'
import type { CartCustomization } from '@/lib/cart'
import {
  defaultSelections,
  effectiveBasePrice,
  selectionsToCustomizations,
  withoutOutOfStock,
  type Selections,
} from '@/components/menu/item-form'
import { posterTone, type MenuSectionData, type PosterTone, type SectionKind } from '@/components/menu/home/sections'

/**
 * The Counter's deck: one column of big cards per category, side by side.
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

/**
 * How a group of options is drawn when a card opens:
 * - size: one choice whose options cost more as they grow; picking one scales the photo
 * - dial: one choice along a scale (sugar, roast) that costs nothing either way
 * - chips: everything else (flavours, add-ons, several at once)
 */
export type ControlKind = 'size' | 'dial' | 'chips'

const SIZE_NAME = /size|cup|حجم|كوب|كوباية|كباية/i

export function controlKind(customization: ItemCustomizationDto): ControlKind {
  const options = customization.options ?? []
  if (customization.allowMultiple || options.length < 2) return 'chips'
  const adjustments = options.map((o) => Number(o.priceAdjustment ?? 0))
  if (SIZE_NAME.test(`${customization.name?.en ?? ''} ${customization.name?.ar ?? ''}`)) return 'size'
  if (options.length >= 3 && options.length <= 6 && adjustments.every((a) => a === 0)) return 'dial'
  return 'chips'
}

/** The options in the order the café set them. */
export function sortedOptions(customization: ItemCustomizationDto) {
  return [...(customization.options ?? [])].sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
}

/**
 * How much bigger the photo is drawn for the sizes picked: each step up in
 * price is a few percent more. Options that cost the same are the same size.
 */
export function sizeScale(customizations: ItemCustomizationDto[] | undefined, selections: Selections): number {
  let scale = 1
  for (const customization of customizations ?? []) {
    if (controlKind(customization) !== 'size') continue
    const picked = selections[String(customization.id)]?.[0]
    if (picked === undefined) continue
    const prices = [...new Set((customization.options ?? []).map((o) => Number(o.priceAdjustment ?? 0)))].sort((a, b) => a - b)
    const option = customization.options?.find((o) => Number(o.id) === picked)
    const step = prices.indexOf(Number(option?.priceAdjustment ?? 0))
    scale += Math.max(0, step) * 0.07
  }
  return Math.min(scale, 1.25)
}

/** Whether a long press may add the item straight away: it is on and nothing needs choosing. */
export function canQuickAdd(item: CatalogItemDto): boolean {
  if (item.isAvailable === false) return false
  return !(item.customizations ?? []).some((c) => c.isRequired)
}

/** The line a long press adds: the café's defaults, nothing sold out, one of it. */
export function quickAddChoice(item: CatalogItemDto): { customizations: CartCustomization[]; unitPrice: number } {
  const selections = withoutOutOfStock(item.customizations, defaultSelections(item.customizations))
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

export { DECK_TOP } from './chrome'
