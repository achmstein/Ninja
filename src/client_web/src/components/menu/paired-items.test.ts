import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@/api/catalog'
import type { CartLine } from '@/lib/cart'
import { cartNudge, menuById, pairedFor } from './paired-items'

const dish = (id: number, extra: Partial<CatalogItemDto> = {}): CatalogItemDto => ({ id, name: { en: `Dish ${id}` }, price: 10, isAvailable: true, ...extra })

const line = (productId: number): CartLine => ({ productId, nameEn: `Dish ${productId}`, nameAr: '', price: 10, quantity: 1, customizations: [] })

// A cappuccino goes with a waffle, then ice cream, then a cake that is sold out; a waffle goes with a milkshake that needs its size picked
const cappuccino = dish(1, { pairedItemIds: [2, 3, 4] })
const waffle = dish(2, { pairedItemIds: [5] })
const iceCream = dish(3)
const cake = dish(4, { isAvailable: false })
const milkshake = dish(5, { customizations: [{ id: 50, isRequired: true, options: [] }] })
const menu = menuById([cappuccino, waffle, iceCream, cake, milkshake])

describe('pairedFor', () => {
  it("keeps the business's order and drops what this branch is out of", () => {
    expect(pairedFor(cappuccino, menu, []).map((d) => d.id)).toEqual([2, 3])
  })

  it('leaves out what is already in the order', () => {
    expect(pairedFor(cappuccino, menu, [line(1), line(2)]).map((d) => d.id)).toEqual([3])
  })

  it('suggests nothing for a dish that pairs with nothing, or with dishes gone from the menu', () => {
    expect(pairedFor(iceCream, menu, [])).toEqual([])
    expect(pairedFor(dish(9, { pairedItemIds: [99] }), menu, [])).toEqual([])
  })
})

describe('cartNudge', () => {
  it('offers a pairing of the dish added last', () => {
    expect(cartNudge([line(1)], menu, new Set())?.id).toBe(2)
  })

  it('skips what needs a choice first, and what was waved away', () => {
    // The waffle's milkshake needs its size, so the cappuccino's waffle is offered
    expect(cartNudge([line(1), line(3)], menu, new Set())?.id).toBe(2)
    expect(cartNudge([line(1)], menu, new Set([2]))?.id).toBe(3)
  })

  it('offers nothing once the pairings are in the order or waved away', () => {
    expect(cartNudge([line(1), line(2), line(3)], menu, new Set())).toBeNull()
    expect(cartNudge([line(1)], menu, new Set([2, 3]))).toBeNull()
    expect(cartNudge([], menu, new Set())).toBeNull()
  })
})
