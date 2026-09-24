import { describe, expect, it } from 'vitest'
import {
  draftLines,
  resolve,
  type RecipeDraft,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import { type MenuGroup, type MenuOptions } from './menu-options'
import {
  compile,
  guessCell,
  merge,
  reconstruct,
  single,
  split,
  type BuilderState,
  type IngredientSpec,
  type Varying,
} from './recipe-cards'

// The cards compile to what the till deducts; these tests read the result
// through the same resolver the preview and the cost card use.

let groupIndex = 0
function group(
  id: string,
  label: string,
  options: Array<[id: string, name: string, isDefault?: true]>,
  flags: { allowMultiple?: boolean; isRequired?: boolean } = {}
): MenuGroup {
  const index = groupIndex++
  return {
    id,
    label,
    allowMultiple: flags.allowMultiple ?? false,
    isRequired: flags.isRequired ?? false,
    options: options.map(([optionId, name, isDefault], i) => ({
      id: optionId,
      label: name,
      names: [name],
      groupIndex: index,
      index: i,
      isDefault: isDefault === true,
    })),
  }
}

const menuOf = (...groups: MenuGroup[]): MenuOptions => ({
  groups,
  byId: new Map(
    groups.flatMap((g) => g.options.map((o) => [o.id, o] as const))
  ),
})

/** A value split across some groups, written as the cells it holds */
const by = <T>(groupIds: string[], cells: Record<string, T>): Varying<T> => ({
  groupIds,
  cells,
})

let nextKey = 1000
function ingredient(patch: {
  item?: Varying<string | null>
  amount?: Varying<string>
}): IngredientSpec {
  return {
    key: nextKey++,
    item: patch.item ?? single<string | null>(null),
    amount: patch.amount ?? single(''),
  }
}

const state = (
  ingredients: IngredientSpec[],
  custom: SlotDraft[] = []
): BuilderState => ({ ingredients, custom })

/** What one sale with these options takes off the shelf, per stock item */
function deducts(draft: RecipeDraft, chosen: string[]): Record<string, number> {
  const lines = draftLines(draft)
  return Object.fromEntries(resolve(lines, new Set(chosen)))
}

const size = group('size', 'Size', [
  ['11', 'Small', true],
  ['12', 'Large'],
])
const extras = group(
  'extras',
  'Extras',
  [
    ['21', 'Whipped cream'],
    ['22', 'Caramel'],
  ],
  { allowMultiple: true }
)
const sugar = group('sugar', 'Sugar', [
  ['31', 'Plain', true],
  ['32', 'Sweet'],
])

const WHIPPED = '100'
const CARAMEL = '101'
const COFFEE = '102'
const SUGAR = '103'

describe('split and merge', () => {
  const menu = menuOf(size, extras, sugar)

  it('fans a value out over a group without changing what it says', () => {
    expect(split(single('7'), size, menu)).toEqual({
      groupIds: ['size'],
      cells: { '11': '7', '12': '7' },
    })
  })

  it('keeps the groups in menu order however they were split', () => {
    const both = split(split(single('7'), sugar, menu), size, menu)
    expect(both.groupIds).toEqual(['size', 'sugar'])
    expect(both.cells).toEqual({
      '11+31': '7',
      '11+32': '7',
      '12+31': '7',
      '12+32': '7',
    })
  })

  it('merges back to the cells at the standard choice', () => {
    const both = by(['size', 'sugar'], {
      '11+31': '5',
      '11+32': '7',
      '12+31': '9',
      '12+32': '11',
    })
    expect(merge(both, 'sugar', menu)).toEqual({
      groupIds: ['size'],
      cells: { '11': '5', '12': '9' },
    })
    expect(merge(merge(both, 'sugar', menu), 'size', menu)).toEqual({
      groupIds: [],
      cells: { '': '5' },
    })
  })

  it('leaves a value alone when the group is not one it is split by', () => {
    const one = single('7')
    expect(merge(one, 'size', menu)).toBe(one)
    const bySize = split(one, size, menu)
    expect(split(bySize, size, menu)).toBe(bySize)
  })
})

describe('compile', () => {
  const menu = menuOf(size, extras, sugar)

  it('deducts an add-on only when its own option is chosen, whatever else is', () => {
    const draft = compile(
      state([
        ingredient({
          item: single(WHIPPED),
          amount: by(['extras'], { '21': '10', '22': '0' }),
        }),
        ingredient({
          item: single(CARAMEL),
          amount: by(['extras'], { '21': '0', '22': '15' }),
        }),
      ]),
      menu
    )

    expect(deducts(draft, ['11', '31'])).toEqual({})
    expect(deducts(draft, ['11', '31', '21'])).toEqual({ [WHIPPED]: 10 })
    expect(deducts(draft, ['11', '31', '22'])).toEqual({ [CARAMEL]: 15 })
    expect(deducts(draft, ['11', '31', '21', '22'])).toEqual({
      [WHIPPED]: 10,
      [CARAMEL]: 15,
    })
  })

  it('sizes an add-on without deducting it for a sale that skipped it', () => {
    const draft = compile(
      state([
        ingredient({
          item: single(WHIPPED),
          amount: by(['size', 'extras'], {
            '11+21': '10',
            '12+21': '15',
            '11+22': '0',
            '12+22': '0',
          }),
        }),
      ]),
      menu
    )

    expect(deducts(draft, ['12'])).toEqual({})
    expect(deducts(draft, ['12', '21', '22'])).toEqual({ [WHIPPED]: 15 })
    expect(deducts(draft, ['11', '21'])).toEqual({ [WHIPPED]: 10 })
  })

  it('deducts nothing for an optional group without a default until an option is chosen', () => {
    const spoons = group('spoons', 'Sugar?', [
      ['71', 'One spoon'],
      ['72', 'Two spoons'],
    ])
    const draft = compile(
      state([
        ingredient({
          item: single(SUGAR),
          amount: by(['spoons'], { '71': '5', '72': '10' }),
        }),
      ]),
      menuOf(spoons)
    )

    expect(deducts(draft, [])).toEqual({})
    expect(deducts(draft, ['71'])).toEqual({ [SUGAR]: 5 })
    expect(deducts(draft, ['72'])).toEqual({ [SUGAR]: 10 })
  })

  it('counts the first option of a required group without a default as the standard choice', () => {
    const spoons = group(
      'spoons',
      'Sugar',
      [
        ['71', 'One spoon'],
        ['72', 'Two spoons'],
      ],
      { isRequired: true }
    )
    const draft = compile(
      state([
        ingredient({
          item: single(SUGAR),
          amount: by(['spoons'], { '71': '5', '72': '10' }),
        }),
      ]),
      menuOf(spoons)
    )

    expect(deducts(draft, [])).toEqual({ [SUGAR]: 5 })
    expect(deducts(draft, ['72'])).toEqual({ [SUGAR]: 10 })
  })

  it('falls back to the default option of a group the cashier cleared', () => {
    const draft = compile(
      state([
        ingredient({
          item: single(COFFEE),
          amount: by(['size'], { '11': '7', '12': '10' }),
        }),
      ]),
      menu
    )

    expect(deducts(draft, [])).toEqual({ [COFFEE]: 7 })
    expect(deducts(draft, ['12'])).toEqual({ [COFFEE]: 10 })
  })

  it('picks the bag by two exclusive groups and leaves an empty cell as nothing', () => {
    const roast = group('roast', 'Roast', [
      ['41', 'Light'],
      ['42', 'Medium', true],
    ])
    const spice = group('spice', 'Spice', [
      ['51', 'Plain', true],
      ['52', 'Spiced'],
    ])
    const draft = compile(
      state([
        ingredient({
          item: by(['roast', 'spice'], {
            '41+51': '2',
            '41+52': null,
            '42+51': '1',
            '42+52': '3',
          }),
          amount: single('7'),
        }),
      ]),
      menuOf(roast, spice)
    )

    expect(deducts(draft, [])).toEqual({ '1': 7 })
    expect(deducts(draft, ['41', '51'])).toEqual({ '2': 7 })
    expect(deducts(draft, ['42', '52'])).toEqual({ '3': 7 })
    expect(deducts(draft, ['41', '52'])).toEqual({})
  })

  it('takes nothing for a choice whose amount is nothing', () => {
    const draft = compile(
      state([
        ingredient({
          item: single(SUGAR),
          amount: by(['sugar'], { '31': '0', '32': '5' }),
        }),
      ]),
      menu
    )

    expect(deducts(draft, ['31'])).toEqual({})
    expect(deducts(draft, [])).toEqual({})
    expect(deducts(draft, ['32'])).toEqual({ [SUGAR]: 5 })
  })
})

describe('reconstruct', () => {
  const menu = menuOf(size, extras, sugar)

  it('reads back an add-on sized by the size group as the card that wrote it', () => {
    const cards = state([
      ingredient({
        item: single(WHIPPED),
        amount: by(['size', 'extras'], {
          '11+21': '10',
          '12+21': '15',
          '11+22': '0',
          '12+22': '0',
        }),
      }),
    ])
    const read = reconstruct(compile(cards, menu), menu)

    expect(read.custom).toEqual([])
    expect(read.ingredients).toHaveLength(1)
    const [card] = read.ingredients
    expect(card.item).toEqual({ groupIds: [], cells: { '': WHIPPED } })
    expect(card.amount).toEqual({
      groupIds: ['size', 'extras'],
      cells: {
        '11+21': '10',
        '11+22': '0',
        '12+21': '15',
        '12+22': '0',
      },
    })
    expect(deducts(compile(read, menu), ['12', '21'])).toEqual({
      [WHIPPED]: 15,
    })
  })

  it('reads an add-on deducted for an option that is not the first', () => {
    const cards = state([
      ingredient({
        item: single(CARAMEL),
        amount: by(['extras'], { '21': '0', '22': '15' }),
      }),
    ])
    const [card] = reconstruct(compile(cards, menu), menu).ingredients

    expect(card.item).toEqual({ groupIds: [], cells: { '': CARAMEL } })
    expect(card.amount).toEqual({
      groupIds: ['extras'],
      cells: { '21': '0', '22': '15' },
    })
  })

  it('reads back a bag table over two groups', () => {
    const roast = group('roast', 'Roast', [
      ['41', 'Light'],
      ['42', 'Medium', true],
    ])
    const spice = group('spice', 'Spice', [
      ['51', 'Plain', true],
      ['52', 'Spiced'],
    ])
    const cells = { '41+51': '2', '41+52': '4', '42+51': '1', '42+52': '3' }
    const cards = state([
      ingredient({
        item: by(['roast', 'spice'], cells),
        amount: single('7'),
      }),
    ])
    const [card] = reconstruct(
      compile(cards, menuOf(roast, spice)),
      menuOf(roast, spice)
    ).ingredients

    expect(card.item).toEqual({ groupIds: ['roast', 'spice'], cells })
    expect(card.amount).toEqual({ groupIds: [], cells: { '': '7' } })
  })

  it('reads an amount split by two groups at once, which the cards used to refuse', () => {
    const cards = state([
      ingredient({
        item: single(SUGAR),
        amount: by(['size', 'sugar'], {
          '11+31': '0',
          '11+32': '5',
          '12+31': '0',
          '12+32': '10',
        }),
      }),
    ])
    const saved = compile(cards, menu)

    expect(deducts(saved, ['11', '31'])).toEqual({})
    expect(deducts(saved, ['11', '32'])).toEqual({ [SUGAR]: 5 })
    expect(deducts(saved, ['12', '32'])).toEqual({ [SUGAR]: 10 })

    const read = reconstruct(saved, menu)
    expect(read.custom).toEqual([])
    expect(read.ingredients[0].amount).toEqual({
      groupIds: ['size', 'sugar'],
      cells: { '11+31': '0', '11+32': '5', '12+31': '0', '12+32': '10' },
    })
  })

  it('reads a group that changes the bag and whether it is taken at all', () => {
    const cup = group('cup', 'Cup', [
      ['81', 'Mug', true],
      ['82', 'Finjan'],
      ['83', 'Takeaway'],
    ])
    const cards = state([
      ingredient({
        item: by(['cup'], { '81': '200', '82': '201', '83': null }),
        amount: by(['cup'], { '81': '1', '82': '1', '83': '0' }),
      }),
    ])
    const one = menuOf(cup)
    const saved = compile(cards, one)

    expect(deducts(saved, ['81'])).toEqual({ '200': 1 })
    expect(deducts(saved, ['82'])).toEqual({ '201': 1 })
    expect(deducts(saved, ['83'])).toEqual({})

    const read = reconstruct(saved, one)
    expect(read.custom).toEqual([])
    expect(deducts(compile(read, one), ['82'])).toEqual({ '201': 1 })
    expect(deducts(compile(read, one), ['83'])).toEqual({})
  })

  it('repairs a recipe saved when the first add-on counted as the standard choice', () => {
    // What the cards used to write for "whipped cream, only with Whipped
    // cream", as the editor reads it back: a default equal to the add-on's
    // own cell, so the cell is empty, and "nothing" for the sibling
    const legacy: SlotDraft = {
      key: 1,
      stockItemId: WHIPPED,
      quantity: '10',
      hasDefault: true,
      groupIds: ['extras'],
      overrides: [
        {
          key: 2,
          optionIds: ['21'],
          stockItemId: null,
          quantity: '',
          none: false,
        },
        {
          key: 3,
          optionIds: ['22'],
          stockItemId: null,
          quantity: '',
          none: true,
        },
      ],
    }
    const saved: RecipeDraft = { slots: [legacy] }
    expect(deducts(saved, [])).toEqual({ [WHIPPED]: 10 })

    const read = reconstruct(saved, menu)
    expect(read.custom).toEqual([])
    expect(read.ingredients[0].amount).toEqual({
      groupIds: ['extras'],
      cells: { '21': '10', '22': '0' },
    })

    const repaired = compile(read, menu)
    expect(deducts(repaired, [])).toEqual({})
    expect(deducts(repaired, ['21', '22'])).toEqual({ [WHIPPED]: 10 })
  })

  it('repairs an add-on group with a single option, whose only rule was an empty cell', () => {
    const shot = group('shot', 'Extra shot', [['61', 'Extra shot']], {
      allowMultiple: true,
    })
    const legacy: SlotDraft = {
      key: 1,
      stockItemId: COFFEE,
      quantity: '7',
      hasDefault: true,
      groupIds: ['shot'],
      overrides: [
        {
          key: 2,
          optionIds: ['61'],
          stockItemId: null,
          quantity: '',
          none: false,
        },
      ],
    }
    const read = reconstruct({ slots: [legacy] }, menuOf(shot))

    expect(read.ingredients[0].amount).toEqual({
      groupIds: ['shot'],
      cells: { '61': '7' },
    })
    const repaired = compile(read, menuOf(shot))
    expect(deducts(repaired, [])).toEqual({})
    expect(deducts(repaired, ['61'])).toEqual({ [COFFEE]: 7 })
  })

  it('keeps a genuine replacement on an add-on as a custom rule', () => {
    const cup: SlotDraft = {
      key: 1,
      stockItemId: '110',
      quantity: '1',
      hasDefault: true,
      groupIds: ['extras'],
      overrides: [
        {
          key: 2,
          optionIds: ['21'],
          stockItemId: '111',
          quantity: '',
          none: false,
        },
      ],
    }
    const read = reconstruct({ slots: [cup] }, menu)

    expect(read.ingredients).toEqual([])
    expect(read.custom).toEqual([cup])
  })

  it('keeps a rule naming an option the menu no longer has, rather than losing it', () => {
    const stale: SlotDraft = {
      key: 1,
      stockItemId: COFFEE,
      quantity: '7',
      hasDefault: true,
      groupIds: ['size'],
      overrides: [
        {
          key: 2,
          // the id a re-issued customization left behind
          optionIds: ['999'],
          stockItemId: null,
          quantity: '14',
          none: false,
        },
      ],
    }
    const read = reconstruct({ slots: [stale] }, menu)

    expect(read.ingredients).toEqual([])
    expect(read.custom).toEqual([stale])
  })
})

describe('guessCell', () => {
  const roast = group('roast', 'التحميص', [
    ['41', 'فاتح'],
    ['42', 'وسط', true],
    ['43', 'غامق'],
  ])
  const spice = group('spice', 'التحويجة', [
    ['51', 'سادة', true],
    ['52', 'محوج'],
  ])
  const shelf = [
    { value: '1', names: ['بن تركي وسط سادة'] },
    { value: '2', names: ['بن تركي فاتح محوج'] },
    { value: '3', names: ['بن تركي غامق سادة'] },
  ]
  const [light, , dark] = roast.options
  const [plain, spiced] = spice.options

  it('swaps the choice words in the base bag name', () => {
    expect(guessCell(shelf[0], [light, spiced], [roast, spice], shelf)).toBe(
      '2'
    )
    expect(guessCell(shelf[0], [dark, plain], [roast, spice], shelf)).toBe('3')
  })

  it('leaves a cell empty when no bag on the shelf fits', () => {
    expect(
      guessCell(shelf[0], [dark, spiced], [roast, spice], shelf)
    ).toBeNull()
  })
})
