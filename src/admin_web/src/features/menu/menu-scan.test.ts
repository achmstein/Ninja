import { describe, expect, it } from 'vitest'
import { type MenuProposal } from '@/api/catalog'
import {
  isReviewItemReady,
  NEW_CATEGORY,
  reviewItemPrice,
  toImportRequest,
  toReviewCategories,
} from './menu-scan'

const proposal: MenuProposal = {
  categories: [
    {
      name: { en: 'Hot Drinks', ar: 'مشروبات سخنة' },
      catalogTypeId: 3,
      items: [
        {
          rawText: 'Latte 45 55',
          name: { en: 'Latte', ar: 'لاتيه' },
          description: { en: '', ar: null },
          price: 45,
          existingItemId: null,
          choice: {
            name: { en: 'Size', ar: 'الحجم' },
            options: [
              { name: { en: 'Small', ar: 'صغير' }, price: 45 },
              { name: { en: 'Large', ar: 'كبير' }, price: 55 },
            ],
          },
        },
        {
          rawText: 'Turkish Coffee 25',
          name: { en: 'Turkish Coffee', ar: 'قهوة تركي' },
          description: { en: '', ar: null },
          price: 25,
          existingItemId: 10,
        },
      ],
    },
    {
      name: { en: 'Desserts', ar: 'حلويات' },
      catalogTypeId: null,
      items: [
        {
          rawText: 'Cake',
          name: { en: 'Cake', ar: '' },
          description: { en: '', ar: null },
          price: 0,
          existingItemId: null,
        },
      ],
    },
  ],
  warnings: [],
  notes: null,
}

describe('menu review', () => {
  it('saves the ticked items: sizes with full prices, an existing category by id, a new one by name', () => {
    const sections = toReviewCategories(proposal)
    sections[1].items[0].price = '60'

    const request = toImportRequest(sections)

    expect(request.categories).toHaveLength(2)
    const [hot, desserts] = request.categories
    expect(hot.catalogTypeId).toBe(3)
    expect(hot.name).toBeNull()
    // Already on the menu: starts unticked, so it is not sent
    expect(hot.items.map((i) => i.name.en)).toEqual(['Latte'])
    expect(hot.items[0].price).toBe(45)
    expect(hot.items[0].choice?.options.map((o) => o.price)).toEqual([45, 55])
    expect(desserts.catalogTypeId).toBeNull()
    expect(desserts.name).toEqual({ en: 'Desserts', ar: 'حلويات' })
    expect(desserts.items[0].price).toBe(60)
  })

  it('an item with sizes costs its cheapest, and is ready only when each size is named and priced', () => {
    const [latte] = toReviewCategories(proposal)[0].items
    latte.choice!.options[1].price = '40'
    expect(reviewItemPrice(latte)).toBe(40)
    expect(isReviewItemReady(latte)).toBe(true)

    latte.choice!.options[0].price = ''
    expect(reviewItemPrice(latte)).toBeNull()
    expect(isReviewItemReady(latte)).toBe(false)
  })

  it('an item named in Arabic only is ready; one named in neither is not', () => {
    const [latte] = toReviewCategories(proposal)[0].items
    latte.name = { en: '', ar: 'لاتيه' }
    latte.choice = null
    latte.price = '45'
    expect(isReviewItemReady(latte)).toBe(true)

    latte.name = { en: ' ', ar: '' }
    expect(isReviewItemReady(latte)).toBe(false)
  })

  it('a section the assistant could not match starts as a new category', () => {
    expect(toReviewCategories(proposal)[1].catalogTypeId).toBe(NEW_CATEGORY)
  })
})
