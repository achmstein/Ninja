import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@/api/catalog/types.gen'
import { basePrice, tillSuggestions, type SaleLine } from './cart'

const latte: SaleLine = {
  productId: 1,
  nameEn: 'Latte',
  nameAr: 'لاتيه',
  // 50 and a +10 large, as the pad shows it
  price: 60,
  quantity: 1,
  customizations: [
    {
      customizationId: 3,
      customizationNameEn: 'Size',
      customizationNameAr: 'الحجم',
      optionId: 9,
      optionNameEn: 'Large',
      optionNameAr: 'كبير',
      priceAdjustment: 10,
    },
  ],
}

describe('basePrice', () => {
  it('takes the options off, since Ordering adds them back', () => {
    expect(basePrice(latte)).toBe(50)
  })

  it('is the price itself when nothing was chosen', () => {
    expect(basePrice({ price: 35, customizations: [] })).toBe(35)
  })
})

describe('tillSuggestions', () => {
  const dish = (id: number, extra: Partial<CatalogItemDto> = {}): CatalogItemDto => ({
    id,
    name: { en: `Dish ${id}` },
    price: 10,
    isAvailable: true,
    ...extra,
  })
  // A cappuccino goes with a waffle, then ice cream, then a cake that is sold out
  const cappuccino = dish(1, { pairedItemIds: [2, 3, 4] })
  const menu = [cappuccino, dish(2), dish(3), dish(4, { isAvailable: false })]

  it("offers what the last dish goes well with, in the business's order, and nothing sold out", () => {
    expect(tillSuggestions(cappuccino, menu, [{ productId: 1 }]).map((d) => d.id)).toEqual([2, 3])
  })

  it('leaves out what is already on the sale', () => {
    expect(tillSuggestions(cappuccino, menu, [{ productId: 1 }, { productId: 2 }]).map((d) => d.id)).toEqual([3])
  })

  it('offers nothing before a dish is rung up', () => {
    expect(tillSuggestions(null, menu, [])).toEqual([])
  })
})
