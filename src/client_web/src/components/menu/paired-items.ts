import type { CatalogItemDto } from '@/api/catalog'
import type { CartLine } from '@/lib/cart'
import { canQuickAdd } from './deck/deck-model'

/** Every dish on the menu by id, to read a dish's pairings against. */
export function menuById(items: readonly CatalogItemDto[]): Map<string, CatalogItemDto> {
  return new Map(items.map((item) => [String(item.id), item]))
}

/**
 * What a dish suggests alongside it ("goes well with"), in the business's
 * order: only what this branch sells right now, never the dish itself, and
 * nothing already in the order.
 */
export function pairedFor(item: CatalogItemDto, menu: ReadonlyMap<string, CatalogItemDto>, lines: readonly CartLine[]): CatalogItemDto[] {
  const inOrder = new Set(lines.map((line) => line.productId))
  return (item.pairedItemIds ?? [])
    .map((id) => menu.get(String(id)))
    .filter((paired): paired is CatalogItemDto => !!paired && paired.isAvailable !== false && String(paired.id) !== String(item.id) && !inOrder.has(Number(paired.id)))
}

/** At most this many suggestions on a dish's sheet: a few to glance at, never a second menu. */
export const MAX_ON_SHEET = 3

/**
 * The one suggestion the order offers, once: the first pairing of the dishes
 * in it, the last added first, that can go in with one tap (nothing to
 * choose). None once the order holds anything a suggestion added, so taking
 * one never brings on the next; the customer waving it away is kept by the
 * caller, for the rest of the order.
 */
export function cartNudge(lines: readonly CartLine[], menu: ReadonlyMap<string, CatalogItemDto>): CatalogItemDto | null {
  if (lines.some((line) => line.suggestion)) return null
  for (const line of [...lines].reverse()) {
    const item = menu.get(String(line.productId))
    if (!item) continue
    const offer = pairedFor(item, menu, lines).find(canQuickAdd)
    if (offer) return offer
  }
  return null
}
