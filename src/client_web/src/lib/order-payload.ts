import type { CartLine } from '@/lib/cart'
import type { OrderDestination } from '@/lib/order-destination'
import { placeKindName } from '@/lib/places'

/**
 * The order a cart becomes, and what stands between a guest and sending it.
 * Pure, so every surface that places an order (the cart page, the Counter's
 * tray) sends the same body under the same rules: see use-place-order.
 */

/** What checkout needs first, if anything: a table scanned, or an account. */
export type CheckoutBlock = 'table' | 'account' | null

export function checkoutBlock({
  isGuest,
  destination,
  guestOrdersAnywhere,
  requireSignInForTableOrders,
}: {
  isGuest: boolean
  destination: OrderDestination
  guestOrdersAnywhere: boolean
  requireSignInForTableOrders: boolean
}): CheckoutBlock {
  if (!isGuest) return null
  // A guest orders against the table they sit at, unless the café takes guests' orders from anywhere, to collect
  if (!destination && !guestOrdersAnywhere) return 'table'
  // The branch wants a name it can hold to on a table order
  if (destination?.kind === 'place' && requireSignInForTableOrders) return 'account'
  return null
}

export type OrderExtras = {
  note: string
  /** Points the quote turned into a discount; 0 for none */
  points: number
  /** The code the quote accepted, or null */
  promo: string | null
  loyaltyDiscount: number
}

export const NO_EXTRAS: OrderExtras = { note: '', points: 0, promo: null, loyaltyDiscount: 0 }

/** Same payload, same signature: a retried submit reuses its request id and is deduplicated server-side. */
export function orderSignature(lines: CartLine[], extras: OrderExtras, guestId: string | null, destination: OrderDestination): string {
  return JSON.stringify({
    lines: lines.map((line) => [
      line.productId,
      line.quantity,
      line.specialInstructions,
      line.customizations.map((c) => [c.customizationId, c.optionId]),
    ]),
    note: extras.note.trim(),
    points: extras.points,
    promo: extras.promo,
    // Signing in mid-cart makes it a different order, not a retry
    guest: guestId,
    // Moving between a table and a room makes it a different order, not a retry
    destination: destination ? [destination.kind, destination.placeId, destination.sessionId ?? 0] : null,
  })
}

export function orderBody({
  lines,
  extras,
  isGuest,
  profile,
  guestContact,
  destination,
  newId = () => crypto.randomUUID(),
}: {
  lines: CartLine[]
  extras: OrderExtras
  isGuest: boolean
  profile: { sub?: string; name?: string; preferred_username?: string } | undefined
  guestContact: { name: string; phone: string } | null
  destination: OrderDestination
  newId?: () => string
}) {
  return {
    // The server identifies the customer from the token (or, for a guest,
    // the X-Guest-Id header) and ignores these; they stay for the shape
    userId: profile?.sub ?? '',
    userName: profile?.name || profile?.preferred_username || '',
    guestName: guestContact?.name ?? null,
    guestPhone: guestContact?.phone ?? null,
    // Where the order goes, and the customer's running clock there if any
    placeId: destination?.placeId ?? null,
    placeKind: destination ? placeKindName(destination.placeKind) : null,
    placeName: destination ? { en: destination.name.en ?? '', ar: destination.name.ar ?? null } : null,
    sessionId: destination?.sessionId ?? null,
    customerNote: extras.note.trim() || null,
    promoCode: extras.promo,
    // Loyalty needs an account to redeem against; the server rejects a guest order that claims either
    pointsToRedeem: isGuest ? 0 : extras.points,
    loyaltyDiscount: isGuest ? 0 : extras.loyaltyDiscount,
    items: lines.map((line) => ({
      id: newId(),
      productId: line.productId,
      productName: { en: line.nameEn, ar: line.nameAr || null },
      unitPrice: line.price,
      quantity: line.quantity,
      pictureUrl: line.pictureUrl ?? null,
      specialInstructions: line.specialInstructions ?? null,
      selectedCustomizations: line.customizations.map((c) => ({
        customizationId: c.customizationId,
        customizationName: { en: c.customizationNameEn, ar: c.customizationNameAr ?? null },
        optionId: c.optionId,
        optionName: { en: c.optionNameEn, ar: c.optionNameAr ?? null },
        priceAdjustment: c.priceAdjustment,
      })),
    })),
  }
}
