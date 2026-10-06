import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// A snapshot of a chosen customization option at add-to-cart time
export type CartCustomization = {
  customizationId: number
  customizationNameEn: string
  customizationNameAr?: string
  optionId: number
  optionNameEn: string
  optionNameAr?: string
  priceAdjustment: number
}

// A snapshot of the item at add-to-cart time; the backend re-validates
// everything when the order is created. Names are as the business wrote them:
// '' for a language it does not write in, never a copy of the other one.
export type CartLine = {
  productId: number
  nameEn: string
  nameAr: string
  /** Unit price including customization adjustments */
  price: number
  pictureUrl?: string
  quantity: number
  specialInstructions?: string
  customizations: CartCustomization[]
  /**
   * Added from a suggestion ("goes well with"): on a dish's sheet, or the
   * one the order offers. Not part of the line's key: added again by hand,
   * it is the same line, and keeps saying how it first came.
   */
  suggestion?: 'Pairing' | 'CartNudge'
}

function lineKey(
  line: Pick<
    CartLine,
    'productId' | 'customizations' | 'specialInstructions'
  >
): string {
  const options = line.customizations
    .map((c) => c.optionId)
    .sort((a, b) => a - b)
    .join(',')
  return `${line.productId}:${options}:${line.specialInstructions ?? ''}`
}

type CartState = {
  lines: CartLine[]
  add: (line: CartLine) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  /** The order as another branch takes it (lib/order-move.ts) */
  setLines: (lines: CartLine[]) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
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
      remove: (key) =>
        set((state) => ({
          lines: state.lines.filter((l) => lineKey(l) !== key),
        })),
      setLines: (lines) => set({ lines }),
      clear: () => set({ lines: [] }),
    }),
    { name: 'ninja-cart' }
  )
)

export { lineKey }

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}
