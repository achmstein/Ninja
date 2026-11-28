import { describe, expect, it } from 'vitest'
import type { CatalogItemDto } from '@ninja/api/catalog/types.gen'
import { basePrice, lineKey, roundsByPerson, tillSuggestions, type SaleLine } from './cart'

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

describe('tillSuggestions', () => {
  const item = (id: number, extra: Partial<CatalogItemDto> = {}): CatalogItemDto => ({
    id,
    name: { en: `Item ${id}` },
    price: 10,
    isAvailable: true,
    ...extra,
  })
  // A cappuccino goes with a waffle, then ice cream, then a cake that is sold out
  const cappuccino = item(1, { pairedItemIds: [2, 3, 4] })
  const menu = [cappuccino, item(2), item(3), item(4, { isAvailable: false })]

  it("offers what the last item goes well with, in the business's order, and nothing sold out", () => {
    expect(tillSuggestions(cappuccino, menu, [{ productId: 1 }]).map((d) => d.id)).toEqual([2, 3])
  })

  it('leaves out what is already on the sale', () => {
    expect(tillSuggestions(cappuccino, menu, [{ productId: 1 }, { productId: 2 }]).map((d) => d.id)).toEqual([3])
  })

  it('offers nothing before an item is rung up', () => {
    expect(tillSuggestions(null, menu, [])).toEqual([])
  })
})

describe('whose a line on a bill is', () => {
  const ahmed = { id: 'a1', name: 'Ahmed' }
  const omar = { id: null, name: 'Omar' }

  it('keeps the same item for two people as two lines, and one for nobody as it always was', () => {
    expect(lineKey({ ...latte, who: ahmed })).not.toBe(lineKey({ ...latte, who: omar }))
    expect(lineKey({ ...latte, who: ahmed })).not.toBe(lineKey(latte))
    expect(lineKey({ ...latte, who: null })).toBe(lineKey(latte))
    expect(lineKey({ ...latte, who: { ...ahmed, name: 'Ahmed A.' } })).toBe(lineKey({ ...latte, who: ahmed }))
  })

  it('sends what is new person by person, in the order they first appear', () => {
    const tea: SaleLine = { ...latte, productId: 2, customizations: [] }
    const rounds = roundsByPerson([
      { ...latte, who: ahmed },
      tea,
      { ...tea, who: omar },
      { ...tea, who: ahmed },
      { ...latte, who: null },
    ])
    expect(rounds.map((round) => [round.who?.name ?? null, round.lines.length])).toEqual([
      ['Ahmed', 2],
      [null, 2],
      ['Omar', 1],
    ])
  })
})
