import { describe, expect, it } from 'vitest'
import { basePrice, type SaleLine } from './cart'

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
