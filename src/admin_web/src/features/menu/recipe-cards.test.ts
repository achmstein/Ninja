import { describe, expect, it } from 'vitest'
import {
  draftLines,
  resolve,
  type RecipeDraft,
  type ScaleDraft,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import { type MenuGroup, type MenuOptions } from './menu-options'
import {
  compile,
  guessCell,
  reconstruct,
  type BuilderState,
  type IngredientSpec,
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

let nextKey = 1000
function ingredient(patch: {
  item?: Partial<IngredientSpec['item']>
  amount?: Partial<IngredientSpec['amount']>
  when?: Partial<IngredientSpec['when']>
}): IngredientSpec {
  return {
    key: nextKey++,
    item: { fixed: null, groupIds: [], cells: {}, ...patch.item },
    amount: { fixed: '', groupId: null, values: {}, ...patch.amount },
    when: { groupId: null, only: [], ...patch.when },
  }
}

const state = (
  ingredients: IngredientSpec[],
  custom: SlotDraft[] = [],
  scales: ScaleDraft[] = []
): BuilderState => ({ ingredients, custom, scales })

/** What one sale with these options takes off the shelf, per stock item */
function deducts(draft: RecipeDraft, chosen: string[]): Record<string, number> {
  const { lines, scales } = draftLines(draft)
  return Object.fromEntries(resolve(lines, scales, new Set(chosen)))
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

describe('compile', () => {
  const menu = menuOf(size, extras, sugar)

  it('deducts an add-on only when its own option is chosen, whatever else is', () => {
    const draft = compile(
      state([
        ingredient({
          item: { fixed: WHIPPED },
          amount: { fixed: '10' },
          when: { groupId: 'extras', only: ['21'] },
        }),
        ingredient({
          item: { fixed: CARAMEL },
          amount: { fixed: '15' },
          when: { groupId: 'extras', only: ['22'] },
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
          item: { fixed: WHIPPED },
          amount: { groupId: 'size', values: { '11': '10', '12': '15' } },
          when: { groupId: 'extras', only: ['21'] },
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
          item: { fixed: SUGAR },
          amount: { groupId: 'spoons', values: { '71': '5', '72': '10' } },
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
          item: { fixed: SUGAR },
          amount: { groupId: 'spoons', values: { '71': '5', '72': '10' } },
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
          item: { fixed: COFFEE },
          amount: { groupId: 'size', values: { '11': '7', '12': '10' } },
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
          item: {
            fixed: '1',
            groupIds: ['roast', 'spice'],
            cells: { '41+51': '2', '41+52': null, '42+51': '1', '42+52': '3' },
          },
          amount: { fixed: '7' },
        }),
      ]),
      menuOf(roast, spice)
    )

    expect(deducts(draft, [])).toEqual({ '1': 7 })
    expect(deducts(draft, ['41', '51'])).toEqual({ '2': 7 })
    expect(deducts(draft, ['42', '52'])).toEqual({ '3': 7 })
    expect(deducts(draft, ['41', '52'])).toEqual({})
  })
})

describe('reconstruct', () => {
  const menu = menuOf(size, extras, sugar)

  it('reads back an add-on sized by the size group as the card that wrote it', () => {
    const cards = state([
      ingredient({
        item: { fixed: WHIPPED },
        amount: { groupId: 'size', values: { '11': '10', '12': '15' } },
        when: { groupId: 'extras', only: ['21'] },
      }),
    ])
    const read = reconstruct(compile(cards, menu), menu)

    expect(read.custom).toEqual([])
    expect(read.ingredients).toHaveLength(1)
    const [card] = read.ingredients
    expect(card.item).toEqual({ fixed: WHIPPED, groupIds: [], cells: {} })
    expect(card.amount).toEqual({
      fixed: '10',
      groupId: 'size',
      values: { '11': '10', '12': '15' },
    })
    expect(card.when).toEqual({ groupId: 'extras', only: ['21'] })
    expect(deducts(compile(read, menu), ['12', '21'])).toEqual({
      [WHIPPED]: 15,
    })
  })

  it('reads an add-on deducted for an option that is not the first', () => {
    const cards = state([
      ingredient({
        item: { fixed: CARAMEL },
        amount: { fixed: '15' },
        when: { groupId: 'extras', only: ['22'] },
      }),
    ])
    const [card] = reconstruct(compile(cards, menu), menu).ingredients

    expect(card.amount.fixed).toBe('15')
    expect(card.when).toEqual({ groupId: 'extras', only: ['22'] })
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
        item: { fixed: '1', groupIds: ['roast', 'spice'], cells },
        amount: { fixed: '7' },
      }),
    ])
    const [card] = reconstruct(
      compile(cards, menuOf(roast, spice)),
      menuOf(roast, spice)
    ).ingredients

    expect(card.item).toEqual({
      fixed: '1',
      groupIds: ['roast', 'spice'],
      cells,
    })
    expect(card.amount).toEqual({ fixed: '7', groupId: null, values: {} })
    expect(card.when).toEqual({ groupId: null, only: [] })
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
      scalable: false,
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
    const saved: RecipeDraft = { slots: [legacy], scales: [] }
    expect(deducts(saved, [])).toEqual({ [WHIPPED]: 10 })

    const read = reconstruct(saved, menu)
    expect(read.custom).toEqual([])
    expect(read.ingredients[0].when).toEqual({
      groupId: 'extras',
      only: ['21'],
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
      scalable: false,
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
    const read = reconstruct({ slots: [legacy], scales: [] }, menuOf(shot))

    expect(read.ingredients[0].when).toEqual({ groupId: 'shot', only: ['61'] })
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
      scalable: false,
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
    const read = reconstruct({ slots: [cup], scales: [] }, menu)

    expect(read.ingredients).toEqual([])
    expect(read.custom).toEqual([cup])
  })
})

describe('size factors from before the cards', () => {
  const menu = menuOf(size, sugar)
  const large: ScaleDraft = { optionId: '12', factor: '1.5' }

  it('become amounts per size on a row that grew with them', () => {
    const coffee: SlotDraft = {
      key: 1,
      stockItemId: COFFEE,
      quantity: '7',
      hasDefault: true,
      scalable: true,
      groupIds: [],
      overrides: [],
    }
    const read = reconstruct({ slots: [coffee], scales: [large] }, menu)

    expect(read.ingredients[0].amount).toEqual({
      fixed: '7',
      groupId: 'size',
      values: { '11': '7', '12': '10.5' },
    })
    const compiled = compile(read, menu)
    expect(compiled.scales).toEqual([])
    expect(deducts(compiled, ['12'])).toEqual({ [COFFEE]: 10.5 })
  })

  it('fold into amounts that are already per size', () => {
    const coffee: SlotDraft = {
      key: 1,
      stockItemId: COFFEE,
      quantity: '7',
      hasDefault: true,
      scalable: true,
      groupIds: ['size'],
      overrides: [
        {
          key: 2,
          optionIds: ['12'],
          stockItemId: null,
          quantity: '10.5',
          none: false,
        },
      ],
    }
    const saved: RecipeDraft = { slots: [coffee], scales: [large] }
    const read = reconstruct(saved, menu)

    expect(read.ingredients[0].amount.values).toEqual({
      '11': '7',
      '12': '15.75',
    })
    expect(deducts(compile(read, menu), ['12'])).toEqual(deducts(saved, ['12']))
  })

  it('keep a row whose amount hangs on another group as a custom rule that still grows', () => {
    const coffee: SlotDraft = {
      key: 1,
      stockItemId: COFFEE,
      quantity: '7',
      hasDefault: true,
      scalable: true,
      groupIds: ['sugar'],
      overrides: [
        {
          key: 2,
          optionIds: ['32'],
          stockItemId: null,
          quantity: '9',
          none: false,
        },
      ],
    }
    const saved: RecipeDraft = { slots: [coffee], scales: [large] }
    const read = reconstruct(saved, menu)

    expect(read.ingredients).toEqual([])
    expect(read.custom).toEqual([coffee])
    const compiled = compile(read, menu)
    expect(compiled.scales).toEqual([large])
    expect(deducts(compiled, ['12', '31'])).toEqual({ [COFFEE]: 10.5 })
    expect(deducts(compiled, ['12', '32'])).toEqual({ [COFFEE]: 13.5 })
  })

  it('go when the custom rules are dropped', () => {
    const coffee: SlotDraft = {
      key: 1,
      stockItemId: COFFEE,
      quantity: '7',
      hasDefault: true,
      scalable: true,
      groupIds: ['sugar'],
      overrides: [
        {
          key: 2,
          optionIds: ['32'],
          stockItemId: null,
          quantity: '9',
          none: false,
        },
      ],
    }
    const read = reconstruct({ slots: [coffee], scales: [large] }, menu)

    expect(compile({ ...read, custom: [] }, menu).scales).toEqual([])
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
