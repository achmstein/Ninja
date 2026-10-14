import type { BasketItem } from '@/api/ordering/types.gen'
import { basePrice, type SaleLine } from './cart'

/**
 * The sale's lines as Ordering's basket items: the same mapping as
 * client_web's checkout, for a charge at the till and for an offline sale
 * replayed later alike.
 */
export function toBasketItems(lines: readonly SaleLine[]): BasketItem[] {
  return lines.map((line) => ({
    id: crypto.randomUUID(),
    productId: line.productId,
    productName: { en: line.nameEn || null, ar: line.nameAr || null },
    // Before the options: Ordering adds them back on
    unitPrice: basePrice(line),
    quantity: line.quantity,
    pictureUrl: line.pictureUrl ?? null,
    specialInstructions: line.specialInstructions ?? null,
    suggestion: line.suggestion ?? ('None' as const),
    selectedCustomizations: line.customizations.map((c) => ({
      customizationId: c.customizationId,
      customizationName: {
        en: c.customizationNameEn || null,
        ar: c.customizationNameAr || null,
      },
      optionId: c.optionId,
      optionName: {
        en: c.optionNameEn || null,
        ar: c.optionNameAr || null,
      },
      priceAdjustment: c.priceAdjustment,
    })),
  }))
}
