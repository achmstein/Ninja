import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@/api/catalog'
import type { CartLine } from '@/lib/cart'
import { cartNudge, menuById, pairedFor } from './paired-items'

const item = (id: number, extra: Partial<CatalogItemDto> = {}): CatalogItemDto => ({ id, name: { en: `Item ${id}` }, price: 10, isAvailable: true, ...extra })

const line = (productId: number): CartLine => ({ productId, nameEn: `Item ${productId}`, nameAr: '', price: 10, quantity: 1, customizations: [] })

// A cappuccino goes with a waffle, then ice cream, then a cake that is sold out; a waffle goes with a milkshake that needs its size picked
const cappuccino = item(1, { pairedItemIds: [2, 3, 4] })
const waffle = item(2, { pairedItemIds: [5] })
const iceCream = item(3)
const cake = item(4, { isAvailable: false })
const milkshake = item(5, { customizations: [{ id: 50, isRequired: true, options: [] }] })
const menu = menuById([cappuccino, waffle, iceCream, cake, milkshake])

describe('pairedFor', () => {
  it("keeps the business's order and drops what this branch is out of", () => {
    expect(pairedFor(cappuccino, menu, []).map((d) => d.id)).toEqual([2, 3])
  })

  it('leaves out what is already in the order', () => {
    expect(pairedFor(cappuccino, menu, [line(1), line(2)]).map((d) => d.id)).toEqual([3])
  })

  it('suggests nothing for an item that pairs with nothing, or with items gone from the menu', () => {
    expect(pairedFor(iceCream, menu, [])).toEqual([])
    expect(pairedFor(item(9, { pairedItemIds: [99] }), menu, [])).toEqual([])
  })
})

describe('cartNudge', () => {
  it('offers a pairing of the item added last', () => {
    expect(cartNudge([line(1)], menu)?.id).toBe(2)
  })

  it('skips what needs a choice first', () => {
    // The waffle's milkshake needs its size, so the cappuccino's ice cream is offered
    expect(cartNudge([line(1), line(2)], menu)?.id).toBe(3)
  })

  it('offers nothing more once the order holds something a suggestion added', () => {
    expect(cartNudge([line(1), { ...line(2), suggestion: 'CartNudge' }], menu)).toBeNull()
    expect(cartNudge([line(1), { ...line(3), suggestion: 'Pairing' }], menu)).toBeNull()
  })

  it('offers nothing once the pairings are in the order, or before there is one', () => {
    expect(cartNudge([line(1), line(2), line(3)], menu)).toBeNull()
    expect(cartNudge([], menu)).toBeNull()
  })
})
