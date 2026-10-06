import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@/api/catalog'
import type { CartLine } from '@/lib/cart'
import { moveLines } from '@/lib/order-move'

const line = (productId: number, price: number, optionIds: number[] = []): CartLine => ({
  productId,
  nameEn: `Dish ${productId}`,
  nameAr: '',
  price,
  quantity: 1,
  customizations: optionIds.map((optionId) => ({
    customizationId: 1,
    customizationNameEn: 'Size',
    optionId,
    optionNameEn: `Option ${optionId}`,
    priceAdjustment: optionId === 2 ? 10 : 0,
  })),
})

const item = (id: number, price: number, extra: Partial<CatalogItemDto> = {}): CatalogItemDto => ({
  id,
  price,
  isAvailable: true,
  customizations: [{ id: 1, options: [{ id: 1, priceAdjustment: 0 }, { id: 2, priceAdjustment: 10 }] }],
  ...extra,
})

describe('moving the order to another branch', () => {
  it('keeps a line the branch serves at the same price as it was', () => {
    const moved = moveLines([line(1, 50)], [item(1, 50)])
    expect(moved.lines).toHaveLength(1)
    expect(moved.dropped).toHaveLength(0)
    expect(moved.repriced).toHaveLength(0)
  })

  it('takes the price there, options and all', () => {
    const moved = moveLines([line(1, 60, [2])], [item(1, 55)])
    expect(moved.lines[0].price).toBe(65)
    expect(moved.repriced).toEqual([expect.objectContaining({ from: 60, to: 65 })])
  })

  it('takes an offer there', () => {
    const moved = moveLines([line(1, 50)], [item(1, 50, { isOnOffer: true, offerPrice: 40 })])
    expect(moved.lines[0].price).toBe(40)
  })

  it('drops a dish not served there, sold out there, or with an option sold out there', () => {
    const moved = moveLines(
      [line(1, 50), line(2, 50), line(3, 50), line(4, 60, [2]), line(5, 50, [9])],
      [
        item(2, 50, { isAvailable: false }),
        item(3, 50, { isOutOfStock: true }),
        item(4, 50, { customizations: [{ id: 1, options: [{ id: 2, priceAdjustment: 10, isOutOfStock: true }] }] }),
        item(5, 50),
      ]
    )
    expect(moved.lines).toHaveLength(0)
    expect(moved.dropped.map((l) => l.productId)).toEqual([1, 2, 3, 4, 5])
  })
})
