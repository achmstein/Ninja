import { describe, expect, it } from 'vitest'
import type { PriceCheckResult } from '@/api/catalog/types.gen'
import type { SaleLine } from './cart'
import { priceCheckLines, reviewPriceCheck } from './price-check'

const line = (productId: number, price: number, optionIds: number[] = []): SaleLine => ({
  productId,
  nameEn: `Item ${productId}`,
  nameAr: '',
  price,
  quantity: 2,
  customizations: optionIds.map((optionId) => ({
    customizationId: 1,
    customizationNameEn: 'Milk',
    optionId,
    optionNameEn: `Option ${optionId}`,
    priceAdjustment: 5,
  })),
})

const result = (itemId: number, price: number, patch: Partial<PriceCheckResult> = {}): PriceCheckResult => ({
  itemId,
  price,
  basePrice: price,
  available: true,
  outOfStock: false,
  soldOutOptionIds: [],
  changed: false,
  wouldPass: true,
  ...patch,
})

describe('priceCheckLines', () => {
  it('sends each line at its price with its options, as the order carries it', () => {
    expect(priceCheckLines([line(1, 70, [9])])).toEqual([{ itemId: 1, optionIds: [9], unitPrice: 70 }])
  })
})

describe('reviewPriceCheck', () => {
  it('sends the cart as it is when the other branch agrees', () => {
    const lines = [line(1, 65), line(2, 40)]
    const review = reviewPriceCheck(lines, [result(1, 65), result(2, 40)])
    expect(review.items).toEqual([])
    expect(review.lines).toEqual(lines)
  })

  it("lists a price that differs and sends the line at the other branch's", () => {
    const review = reviewPriceCheck([line(1, 65)], [result(1, 70, { changed: true, wouldPass: false })])
    expect(review.items).toMatchObject([{ kind: 'changed', from: 65, to: 70 }])
    expect(review.lines).toEqual([{ ...line(1, 65), price: 70 }])
  })

  it('takes off what the other branch ran out of, the item or one of its choices', () => {
    const review = reviewPriceCheck(
      [line(1, 65), line(2, 40, [9]), line(3, 30), line(4, 20)],
      [result(1, 65), result(2, 40, { soldOutOptionIds: ['9'] }), result(3, 30, { outOfStock: true }), result(4, 0, { available: false })],
    )
    expect(review.items.map((i) => i.kind)).toEqual(['optionsOut', 'soldOut', 'soldOut'])
    expect(review.items[0]).toMatchObject({ kind: 'optionsOut', optionIds: [9] })
    expect(review.lines.map((l) => l.productId)).toEqual([1])
  })

  it('reads a line the answer is missing as one the branch cannot make', () => {
    const review = reviewPriceCheck([line(1, 65)], [])
    expect(review.items).toMatchObject([{ kind: 'soldOut' }])
    expect(review.lines).toEqual([])
  })
})
