import { describe, expect, it } from 'vitest'
import { type StockLevelView } from '@/api/inventory'
import { daysLeft, sortLevels } from './stock-sort'

const level = (
  name: string,
  over: Partial<StockLevelView> = {}
): StockLevelView => ({
  stockItemId: name.length,
  name: { en: name, ar: null },
  unit: 'g',
  packSize: null,
  packName: null,
  autoSoldOut: false,
  isActive: true,
  onHand: 0,
  reorderLevel: null,
  avgUnitCost: 0,
  isLow: false,
  value: 0,
  ...over,
})

const nameOf = (l: StockLevelView) => l.name.en ?? ''
const names = (levels: StockLevelView[]) => levels.map(nameOf)

describe('daysLeft', () => {
  it('is what is on hand by what a day uses', () => {
    expect(daysLeft(level('Beans', { onHand: 900, dailyUse: 150 }))).toBe(6)
  })
  it('is nothing to go by when none has been used', () => {
    expect(daysLeft(level('Cups', { onHand: 40 }))).toBeNull()
    expect(daysLeft(level('Cups', { onHand: 40, dailyUse: 0 }))).toBeNull()
  })
  it('is none left when the shelf is empty or the level went under', () => {
    expect(daysLeft(level('Milk', { onHand: -3, dailyUse: 5 }))).toBe(0)
  })
})

describe('sortLevels', () => {
  const levels = [
    level('Sugar', { onHand: 500, dailyUse: 50, value: 20 }),
    level('beans', { onHand: 300, dailyUse: 150, value: 400, isLow: true }),
    level('Cups', { onHand: 40, value: 90 }),
    level('Old syrup', { isActive: false, value: 900, isLow: true }),
  ]

  it('puts low items first, then names, retired last', () => {
    expect(names(sortLevels(levels, 'low', nameOf))).toEqual([
      'beans',
      'Cups',
      'Sugar',
      'Old syrup',
    ])
  })
  it('puts the fewest days left first, items with no use after', () => {
    expect(names(sortLevels(levels, 'daysLeft', nameOf))).toEqual([
      'beans',
      'Sugar',
      'Cups',
      'Old syrup',
    ])
  })
  it('puts the most valuable first', () => {
    expect(names(sortLevels(levels, 'value', nameOf))).toEqual([
      'beans',
      'Cups',
      'Sugar',
      'Old syrup',
    ])
  })
  it('sorts by name whatever the case', () => {
    expect(names(sortLevels(levels, 'name', nameOf))).toEqual([
      'beans',
      'Cups',
      'Sugar',
      'Old syrup',
    ])
  })
})
