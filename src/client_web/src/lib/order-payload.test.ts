import { describe, expect, it } from 'vitest'
import type { CartLine } from '@/lib/cart'
import { checkoutBlock, NO_EXTRAS, orderBody, orderSignature } from './order-payload'

const table = { kind: 'place' as const, placeId: 7, placeKind: 2, name: { en: 'Table 7', ar: 'ترابيزة ٧' }, sessionId: null }

const line: CartLine = {
  productId: 1,
  nameEn: 'Latte',
  nameAr: 'لاتيه',
  price: 70,
  quantity: 2,
  customizations: [
    { customizationId: 3, customizationNameEn: 'Size', optionId: 9, optionNameEn: 'Double', priceAdjustment: 15 },
  ],
}

describe('checkoutBlock', () => {
  const base = { isGuest: true, destination: null, guestOrdersAnywhere: false, requireSignInForTableOrders: false }

  it('lets a signed-in customer through wherever they are', () => {
    expect(checkoutBlock({ ...base, isGuest: false })).toBeNull()
  })

  it('asks a guest with no table to scan one, unless the café takes guest orders anywhere', () => {
    expect(checkoutBlock(base)).toBe('table')
    expect(checkoutBlock({ ...base, guestOrdersAnywhere: true })).toBeNull()
  })

  it('asks a guest at a table to sign in where the branch wants a name', () => {
    expect(checkoutBlock({ ...base, destination: table })).toBeNull()
    expect(checkoutBlock({ ...base, destination: table, requireSignInForTableOrders: true })).toBe('account')
  })
})

describe('orderSignature', () => {
  it('is the same for the same order, and changes with the place or the guest', () => {
    const a = orderSignature([line], NO_EXTRAS, 'g1', table)
    expect(orderSignature([line], NO_EXTRAS, 'g1', table)).toBe(a)
    expect(orderSignature([line], NO_EXTRAS, 'g2', table)).not.toBe(a)
    expect(orderSignature([line], NO_EXTRAS, 'g1', null)).not.toBe(a)
    expect(orderSignature([{ ...line, quantity: 3 }], NO_EXTRAS, 'g1', table)).not.toBe(a)
  })
})

describe('orderBody', () => {
  it('sends the lines, the place and the guest as the cart page does', () => {
    const body = orderBody({
      lines: [line],
      extras: { note: '  by the window ', points: 100, promo: 'SAVE', loyaltyDiscount: 5 },
      isGuest: true,
      profile: undefined,
      guestContact: { name: 'Mona', phone: '01000000000' },
      destination: table,
      newId: () => 'id',
    })
    expect(body).toMatchObject({
      guestName: 'Mona',
      placeId: 7,
      placeKind: 'Table',
      customerNote: 'by the window',
      promoCode: 'SAVE',
      // A guest never redeems points
      pointsToRedeem: 0,
      loyaltyDiscount: 0,
    })
    expect(body.items[0]).toMatchObject({
      id: 'id',
      productId: 1,
      unitPrice: 70,
      quantity: 2,
      productName: { en: 'Latte', ar: 'لاتيه' },
      selectedCustomizations: [{ optionId: 9, priceAdjustment: 15, optionName: { en: 'Double', ar: null } }],
    })
  })

  it('lets an account redeem points', () => {
    const body = orderBody({
      lines: [line],
      extras: { ...NO_EXTRAS, points: 100, loyaltyDiscount: 5 },
      isGuest: false,
      profile: { sub: 'u1', name: 'Ali' },
      guestContact: null,
      destination: null,
    })
    expect(body).toMatchObject({ userId: 'u1', userName: 'Ali', pointsToRedeem: 100, loyaltyDiscount: 5, placeId: null })
  })
})
