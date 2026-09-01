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
// everything when the order is created.
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
  /** Whole-bundle lines only; never sent to the API (mobile parity) */
  bundleId?: number
  /** Pre-discount price for bundle lines, shown struck through */
  originalPrice?: number
}

function lineKey(
  line: Pick<
    CartLine,
    'productId' | 'customizations' | 'specialInstructions' | 'bundleId'
  >
): string {
  const options = line.customizations
    .map((c) => c.optionId)
    .sort((a, b) => a - b)
    .join(',')
  const id = line.bundleId ? `b${line.bundleId}` : line.productId
  return `${id}:${options}:${line.specialInstructions ?? ''}`
}

// Mirrors the mobile app's CartItem.fromBundle: the whole bundle becomes one
// line with productId 0 at the bundle price.
export function lineFromBundle(bundle: {
  id?: number | string
  name?: { en?: string; ar?: string | null }
  bundlePrice?: number | string
  originalPrice?: number | string
  pictureUri?: string | null
}): CartLine {
  const price = Number(bundle.bundlePrice ?? 0)
  const original = Number(bundle.originalPrice ?? 0)
  return {
    productId: 0,
    bundleId: Number(bundle.id),
    nameEn: bundle.name?.en ?? '',
    nameAr: bundle.name?.ar ?? '',
    price,
    originalPrice: original > price ? original : undefined,
    pictureUrl: bundle.pictureUri
      ? `/api/catalog/bundles/${bundle.id}/pic`
      : undefined,
    quantity: 1,
    customizations: [],
  }
}

type CartState = {
  lines: CartLine[]
  add: (line: CartLine) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
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
      clear: () => set({ lines: [] }),
    }),
    { name: 'chillax-cart' }
  )
)

/** For one-shot reads outside the React tree, or where subscribing to every
 *  cart change would only cause needless re-runs. */
export function cartHasItems(): boolean {
  return useCart.getState().lines.length > 0
}

export { lineKey }

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}
