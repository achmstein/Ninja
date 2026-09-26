import { describe, expect, it } from 'vitest'
import type { CatalogItemDto, ItemCustomizationDto } from '@/api/catalog'
import type { MenuSectionData } from '@/components/menu/home/sections'
import {
  buildDeck,
  canQuickAdd,
  columnAt,
  pickUsual,
  pinchIntent,
  positionOf,
  quickAddChoice,
} from './deck-model'

const item = (id: number, x: Partial<CatalogItemDto> = {}): CatalogItemDto =>
  ({ id, name: { en: `Item ${id}`, ar: `صنف ${id}` }, price: 50, catalogTypeId: 1, isAvailable: true, displayOrder: id, ...x }) as CatalogItemDto

const section = (id: string, kind: MenuSectionData['kind'], items: CatalogItemDto[]): MenuSectionData => ({ id, label: id, kind, items })

const option = (id: number, priceAdjustment = 0, x: Record<string, unknown> = {}) => ({
  id,
  name: { en: `Option ${id}`, ar: null },
  priceAdjustment,
  isDefault: false,
  displayOrder: id,
  isOutOfStock: false,
  ...x,
})

const group = (id: number, name: string, options: ReturnType<typeof option>[], x: Partial<ItemCustomizationDto> = {}) =>
  ({ id, name: { en: name, ar: null }, isRequired: false, allowMultiple: false, displayOrder: id, options, ...x }) as ItemCustomizationDto

describe('buildDeck', () => {
  it('leads with the usuals, then each category, and leaves favourites and popular out', () => {
    const deck = buildDeck([
      section('section-usuals', 'usuals', [item(3)]),
      section('section-favorites', 'favorites', [item(1)]),
      section('section-popular', 'popular', [item(2)]),
      section('section-1', 'category', [item(1), item(2)]),
      section('section-2', 'category', [item(3)]),
    ])
    expect(deck.map((c) => c.id)).toEqual(['section-usuals', 'section-1', 'section-2'])
  })

  it('opens on the first category for a guest with no history', () => {
    const deck = buildDeck([section('section-1', 'category', [item(1)])])
    expect(deck[0].id).toBe('section-1')
    expect(pickUsual(deck)).toBeNull()
  })

  it('paints categories in turn: primary, accent, deep, and round again', () => {
    const deck = buildDeck([1, 2, 3, 4].map((n) => section(`section-${n}`, 'category', [item(n)])))
    expect(deck.map((c) => c.tone)).toEqual(['primary', 'secondary', 'deep', 'primary'])
  })
})

describe('pickUsual', () => {
  it('is the first usual still on the menu', () => {
    const deck = buildDeck([section('section-usuals', 'usuals', [item(1, { isAvailable: false }), item(2)])])
    expect(pickUsual(deck)?.id).toBe(2)
  })
})

describe('positionOf', () => {
  it('finds an item in its own category before the usuals', () => {
    const deck = buildDeck([
      section('section-usuals', 'usuals', [item(7)]),
      section('section-1', 'category', [item(1)]),
      section('section-2', 'category', [item(5), item(7)]),
    ])
    expect(positionOf(deck, 7)).toEqual({ column: 2, row: 1 })
    expect(positionOf(deck, 99)).toBeNull()
  })
})

describe('quick add', () => {
  it('is allowed when nothing must be chosen and the item is on', () => {
    expect(canQuickAdd(item(1))).toBe(true)
    expect(canQuickAdd(item(1, { customizations: [group(1, 'Sugar', [option(1), option(2)])] }))).toBe(true)
    expect(canQuickAdd(item(1, { customizations: [group(1, 'Size', [option(1)], { isRequired: true })] }))).toBe(false)
    expect(canQuickAdd(item(1, { isAvailable: false }))).toBe(false)
  })

  it('adds the defaults that are in stock, priced with the offer', () => {
    const x = item(1, {
      isOnOffer: true,
      offerPrice: 40,
      customizations: [
        group(1, 'Extras', [option(1, 5, { isDefault: true }), option(2, 7, { isDefault: true, isOutOfStock: true })], { allowMultiple: true }),
      ],
    })
    const choice = quickAddChoice(x)
    expect(choice.customizations.map((c) => c.optionId)).toEqual([1])
    expect(choice.unitPrice).toBe(45)
  })
})

describe('columnAt', () => {
  it('rounds to the nearest column either way the page runs', () => {
    expect(columnAt(0, 390, 5)).toBe(0)
    expect(columnAt(400, 390, 5)).toBe(1)
    expect(columnAt(-790, 390, 5)).toBe(2)
    expect(columnAt(99999, 390, 5)).toBe(4)
    expect(columnAt(10, 0, 5)).toBe(0)
  })
})

describe('pinchIntent', () => {
  it('zooms out on a pinch closed, in on one opened, and waits in between', () => {
    expect(pinchIntent(200, 150)).toBe('out')
    expect(pinchIntent(200, 270)).toBe('in')
    expect(pinchIntent(200, 190)).toBeNull()
    expect(pinchIntent(0, 100)).toBeNull()
  })
})
