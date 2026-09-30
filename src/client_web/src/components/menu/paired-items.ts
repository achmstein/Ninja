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

/**
 * The one suggestion the order offers: the first pairing of the dishes in
 * it, the last added first, that can go in with one tap (nothing to choose)
 * and that the customer has not waved away.
 */
export function cartNudge(lines: readonly CartLine[], menu: ReadonlyMap<string, CatalogItemDto>, dismissed: ReadonlySet<number>): CatalogItemDto | null {
  for (const line of [...lines].reverse()) {
    const item = menu.get(String(line.productId))
    if (!item) continue
    const offer = pairedFor(item, menu, lines).find((paired) => canQuickAdd(paired) && !dismissed.has(Number(paired.id)))
    if (offer) return offer
  }
  return null
}
