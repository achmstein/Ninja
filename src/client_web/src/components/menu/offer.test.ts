import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@/api/catalog'
import { isOnOffer, offerPercent } from './offer'

const dish = (price: number, offerPrice: number | null, isOnOffer = true) =>
  ({ id: 1, price, offerPrice, isOnOffer }) as unknown as CatalogItemDto

describe('an offer', () => {
  it('takes something off, or it is not one', () => {
    expect(isOnOffer(dish(100, 80))).toBe(true)
    expect(isOnOffer(dish(100, 100))).toBe(false)
    expect(isOnOffer(dish(100, 80, false))).toBe(false)
  })

  it('says its saving as a whole percent', () => {
    expect(offerPercent(dish(100, 80))).toBe(20)
    expect(offerPercent(dish(45, 30))).toBe(33)
    expect(offerPercent(dish(100, 100))).toBe(0)
  })
})
