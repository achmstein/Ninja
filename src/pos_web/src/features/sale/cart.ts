import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The counter-sale cart, ported from client_web/src/lib/cart.ts (minus
// bundles — deals are a customer-app feature; the pad sells catalog items).

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
// when the order is created.
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
  clear: () => void
}

export const useSale = create<SaleState>()(
  persist(
    (set) => ({
      lines: [],
      note: '',
      customer: null,
      target: null,
      setTarget: (target) =>
        set((state) =>
          state.target === target
            ? {}
            : { target, lines: [], note: '', customer: null }
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
      clear: () => set({ lines: [], note: '', customer: null }),
    }),
    // Survives an accidental refresh mid-sale; cleared when the sale lands
    { name: 'chillax-pos-sale' }
  )
)

export function saleTotal(lines: SaleLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
}

export function saleCount(lines: SaleLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}
