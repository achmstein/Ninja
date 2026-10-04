import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CatalogItemDto } from '@/api/catalog/types.gen'

// The counter-sale cart, ported from client_web/src/lib/cart.ts.

// A snapshot of a chosen customization option at add-to-cart time
export type SaleCustomization = {
  customizationId: number
  customizationNameEn: string
  customizationNameAr?: string
  optionId: number
  optionNameEn: string
  optionNameAr?: string
  priceAdjustment: number
}

// A snapshot of the item at add time; the backend re-validates everything
// when the order is created. Names are as the business wrote them: '' for a
// language it does not write in, never a copy of the other one.
export type SaleLine = {
  productId: number
  nameEn: string
  nameAr: string
  /** Unit price including customization adjustments */
  price: number
  pictureUrl?: string
  quantity: number
  specialInstructions?: string
  customizations: SaleCustomization[]
  /**
   * Rung up from what the last dish goes well with. Not part of the line's
   * key: added again by hand it is the same line, and keeps saying so.
   */
  suggestion?: 'Till'
}

/**
 * Who the sale is for. `id` is an identity account — needed to accrue loyalty
 * or settle on a tab. A walk-in the waiters know by name has none: the name
 * still rides along to the kitchen card and the bill line, it just unlocks
 * nothing.
 */
export type SaleCustomer = {
  id: string | null
  name: string
  /** As the search knew it; shown on the customer card. */
  phone?: string | null
}

/**
 * Where a sale the till took over the phone goes. The words are what the
 * caller said; the pin only when they shared their location (a pasted map
 * link, read by Ordering into `latitude`/`longitude`).
 */
export type SaleDelivery = {
  address: string
  building: string
  floor: string
  apartment: string
  directions: string
  phone: string
  /** What the cashier pasted: a Google Maps link or coordinates */
  location: string
  latitude: number | null
  longitude: number | null
}

export const emptyDelivery: SaleDelivery = {
  address: '',
  building: '',
  floor: '',
  apartment: '',
  directions: '',
  phone: '',
  location: '',
  latitude: null,
  longitude: null,
}

/**
 * A line's unit price before its options. The line's `price` has them in it
 * (what the pad shows); Ordering adds them itself, so this is what it is sent.
 */
export function basePrice(
  line: Pick<SaleLine, 'price' | 'customizations'>
): number {
  return (
    line.price -
    line.customizations.reduce((sum, c) => sum + c.priceAdjustment, 0)
  )
}

/**
 * What the till offers after a dish is rung up: what it goes well with, in
 * the business's order, only what this branch sells right now and nothing
 * already on the sale.
 */
export function tillSuggestions(
  last: CatalogItemDto | null,
  items: readonly CatalogItemDto[],
  lines: readonly Pick<SaleLine, 'productId'>[],
): CatalogItemDto[] {
  if (!last) return []
  const byId = new Map(items.map((item) => [String(item.id), item]))
  const onSale = new Set(lines.map((line) => line.productId))
  return (last.pairedItemIds ?? [])
    .map((id) => byId.get(String(id)))
    .filter(
      (item): item is CatalogItemDto =>
        !!item &&
        item.isAvailable !== false &&
        String(item.id) !== String(last.id) &&
        !onSale.has(Number(item.id)),
    )
}

export function lineKey(
  line: Pick<SaleLine, 'productId' | 'customizations' | 'specialInstructions'>
): string {
  const options = line.customizations
    .map((c) => c.optionId)
    .sort((a, b) => a - b)
    .join(',')
  return `${line.productId}:${options}:${line.specialInstructions ?? ''}`
}

type SaleState = {
  lines: SaleLine[]
  note: string
  customer: SaleCustomer | null
  /** A walk-in sale that goes out with a rider instead; never on an open bill. */
  delivery: SaleDelivery | null
  /** The bill these lines are for: a ticket id, or null for a walk-in sale. */
  target: number | null
  /**
   * Point the cart at a destination. Changing it empties the cart: a
   * half-built walk-in must never follow the cashier onto someone's open
   * ticket (or the other way round) — those are different people's money.
   */
  setTarget: (target: number | null) => void
  add: (line: SaleLine) => void
  setQuantity: (key: string, quantity: number) => void
  setNote: (note: string) => void
  setCustomer: (customer: SaleCustomer | null) => void
  setDelivery: (delivery: SaleDelivery | null) => void
  clear: () => void
}

export const useSale = create<SaleState>()(
  persist(
    (set) => ({
      lines: [],
      note: '',
      customer: null,
      delivery: null,
      target: null,
      setTarget: (target) =>
        set((state) =>
          state.target === target
            ? {}
            : { target, lines: [], note: '', customer: null, delivery: null }
        ),
      add: (line) =>
        set((state) => {
          const key = lineKey(line)
          const existing = state.lines.find((l) => lineKey(l) === key)
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                lineKey(l) === key
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l
              ),
            }
          }
          return { lines: [...state.lines, line] }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => lineKey(l) !== key)
              : state.lines.map((l) =>
                  lineKey(l) === key ? { ...l, quantity } : l
                ),
        })),
      setNote: (note) => set({ note }),
      setCustomer: (customer) => set({ customer }),
      setDelivery: (delivery) => set({ delivery }),
      clear: () => set({ lines: [], note: '', customer: null, delivery: null }),
    }),
    // Survives an accidental refresh mid-sale; cleared when the sale lands
    { name: 'ninja-pos-sale' }
  )
)

export function saleTotal(lines: SaleLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
}

export function saleCount(lines: SaleLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}
