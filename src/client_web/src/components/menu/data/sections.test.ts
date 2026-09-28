import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@/api/catalog'
import { buildSections, coverItem, pickHero, posterTone, tileSections } from './sections'

const item = (id: number, x: Partial<CatalogItemDto> = {}): CatalogItemDto =>
  ({
    id,
    name: { en: `Item ${id}`, ar: `صنف ${id}` },
    price: 50,
    catalogTypeId: 1,
    pictureUri: `pic/${id}`,
    isAvailable: true,
    displayOrder: id,
    ...x,
  }) as CatalogItemDto

const localized = (t: { en?: string | null } | null | undefined) => t?.en ?? ''
const labels = { usuals: 'Your usual', favorites: 'Favorites', popular: 'Most Popular' }

describe('buildSections', () => {
  const items = [
    item(1, { catalogTypeId: 2, isPopular: true }),
    item(2, { catalogTypeId: 1 }),
    item(3, { catalogTypeId: 1, displayOrder: 0 }),
    item(4, { catalogTypeId: 9 }),
  ]
  const categories = [
    { id: 2, name: { en: 'Cold', ar: '' }, displayOrder: 2 },
    { id: 1, name: { en: 'Hot', ar: '' }, displayOrder: 1 },
    { id: 3, name: { en: 'Empty', ar: '' }, displayOrder: 3 },
  ]

  it('orders your usuals, favourites, most popular, then each category with items', () => {
    const sections = buildSections({ items, categories, favoriteIds: new Set([2]), topItemIds: [3, 99], labels, localized })
    expect(sections.map((s) => [s.kind, s.label])).toEqual([
      ['usuals', 'Your usual'],
      ['favorites', 'Favorites'],
      ['popular', 'Most Popular'],
      ['category', 'Hot'],
      ['category', 'Cold'],
    ])
    expect(sections[0].items.map((i) => i.id)).toEqual([3])
    expect(sections[3].items.map((i) => i.id)).toEqual([3, 2])
  })

  it('leaves out what a new visitor has not got', () => {
    const sections = buildSections({ items, categories, favoriteIds: new Set(), topItemIds: [], labels, localized })
    expect(sections.map((s) => s.kind)).toEqual(['popular', 'category', 'category'])
  })
})

describe('pickHero', () => {
  const sections = buildSections({
    items: [item(1, { isPopular: true, pictureUri: null }), item(2, { isPopular: true }), item(3)],
    categories: [{ id: 1, name: { en: 'Hot', ar: '' } }],
    favoriteIds: new Set(),
    topItemIds: [],
    labels,
    localized,
  })

  it('opens with the offer that saves the most, when it has a photo', () => {
    const offers = [item(5, { price: 50, offerPrice: 45 }), item(6, { price: 80, offerPrice: 60 }), item(7, { price: 90, offerPrice: 10, pictureUri: null })]
    expect(pickHero(offers, sections)?.id).toBe(6)
  })

  it('falls back to the first popular dish with a photo, then any dish with one, then none', () => {
    expect(pickHero([], sections)?.id).toBe(2)
    expect(pickHero([], [{ id: 's', label: '', kind: 'category', items: [item(8, { pictureUri: null }), item(9)] }])?.id).toBe(9)
    expect(pickHero([], [{ id: 's', label: '', kind: 'category', items: [item(8, { pictureUri: null })] }])).toBeNull()
  })
})

describe('tileSections', () => {
  it('leads with the offers and your usuals, drops most popular, keeps favourites and categories', () => {
    const sections = buildSections({
      items: [item(1, { isPopular: true }), item(2, { catalogTypeId: 2 })],
      categories: [
        { id: 1, name: { en: 'Hot', ar: '' }, displayOrder: 1 },
        { id: 2, name: { en: 'Cold', ar: '' }, displayOrder: 2 },
      ],
      favoriteIds: new Set([2]),
      topItemIds: [1],
      labels,
      localized,
    })
    const tiles = tileSections(sections, [item(1)], 'Offers')
    expect(tiles.map((s) => s.kind)).toEqual(['offers', 'usuals', 'favorites', 'category', 'category'])
    expect(tileSections(sections, [], 'Offers')[0].kind).toBe('usuals')
  })

  it('covers a tile with its first photographed dish, or nothing', () => {
    expect(coverItem({ id: 'a', label: '', kind: 'category', items: [item(1, { pictureUri: null }), item(2)] })?.id).toBe(2)
    expect(coverItem({ id: 'a', label: '', kind: 'category', items: [item(1, { pictureUri: null })] })).toBeNull()
  })
})

describe('posterTone', () => {
  it('cycles the primary, the accent and a darkened primary', () => {
    expect([0, 1, 2, 3, 4].map(posterTone)).toEqual(['primary', 'secondary', 'deep', 'primary', 'secondary'])
  })
})
