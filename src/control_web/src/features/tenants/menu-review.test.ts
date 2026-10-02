import { describe, expect, it } from 'vitest'
import { includedCount, toImportRequest, type DropCategory } from './menu-review'

const item = (key: string, en: string, price: string, include = true) => ({
  key,
  name: { en, ar: null },
  description: { en: null, ar: null },
  price,
  choice: null,
  include,
})

const menu: DropCategory[] = [
  {
    key: 'c0',
    name: { en: 'Hot Drinks', ar: 'مشروبات سخنة' },
    items: [
      item('a', 'Espresso', '45'),
      item('b', 'Americano', '50', false),
      {
        ...item('c', 'Latte', '60'),
        choice: {
          name: { en: 'Size', ar: null },
          options: [
            { name: { en: 'S', ar: null }, price: 60 },
            { name: { en: 'L', ar: null }, price: 75 },
          ],
        },
      },
    ],
  },
  { key: 'c1', name: { en: 'Desserts', ar: null }, items: [item('d', 'Cheesecake', '90', false)] },
]

describe('the menu read while a business is created', () => {
  it('counts only what is ticked', () => {
    expect(includedCount(menu)).toBe(2)
    expect(includedCount(null)).toBe(0)
  })

  it('goes in as new categories with the ticked items, and a section with none is left out', () => {
    const request = toImportRequest(menu) as {
      categories: {
        catalogTypeId: null
        name: unknown
        items: { name: { en: string }; price: number; choice: unknown }[]
      }[]
    }
    expect(request.categories).toHaveLength(1)
    const [hot] = request.categories
    expect(hot.catalogTypeId).toBeNull()
    expect(hot.name).toEqual({ en: 'Hot Drinks', ar: 'مشروبات سخنة' })
    expect(hot.items.map((i) => i.name.en)).toEqual(['Espresso', 'Latte'])
    expect(hot.items[0].price).toBe(45)
    expect(hot.items[1].choice).toEqual({
      name: { en: 'Size', ar: null },
      options: [
        { name: { en: 'S', ar: null }, price: 60 },
        { name: { en: 'L', ar: null }, price: 75 },
      ],
    })
  })

  it('leaves out a dish with no name, and an empty description', () => {
    const request = toImportRequest([
      { key: 'c', name: { en: 'X', ar: null }, items: [item('a', '  ', '10'), item('b', 'Tea', 'abc')] },
    ]) as { categories: { items: { name: { en: string }; price: number; description: unknown }[] }[] }
    expect(request.categories[0].items).toHaveLength(1)
    expect(request.categories[0].items[0].price).toBe(0)
    expect(request.categories[0].items[0].description).toBeNull()
  })
})
