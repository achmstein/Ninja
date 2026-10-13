import { describe, expect, it } from 'vitest'
import { type MenuCostRow } from './menu-cost-rows'
import { countClasses, toMenuEngineering } from './menu-engineering-rows'

const row = (
  id: number,
  price: number,
  cost: number,
  status: MenuCostRow['status'] = 'ok'
): MenuCostRow => ({
  catalogItemId: id,
  name: { en: `Item ${id}` },
  category: undefined,
  price,
  cost,
  margin: price - cost,
  foodCost: price > 0 ? Math.round((cost / price) * 100) : null,
  uncosted: status === 'incomplete' ? 1 : 0,
  uncostedNames: [],
  optionExtras: 0,
  status,
})

const sold = (id: number, qty: number) => ({
  description: { en: `Item ${id}` },
  qty,
  amount: qty * 10,
  tickets: qty,
  catalogItemId: id,
})

describe('toMenuEngineering', () => {
  // Four items, so an even split is 25% and popular starts at 17.5%;
  // the weighted average margin is (40×50 + 10×30 + 40×10 + 10×10) / 100 = 28
  const costs = [row(1, 60, 20), row(2, 40, 30), row(3, 60, 20), row(4, 20, 10)]
  const sales = [sold(1, 50), sold(2, 30), sold(3, 10), sold(4, 10)]

  it('places each item by its share of what sold and its margin against the weighted average', () => {
    const result = toMenuEngineering(costs, sales)
    expect(result.popularityThreshold).toBeCloseTo(0.175)
    expect(result.averageMargin).toBe(28)
    const classOf = (id: number) =>
      result.rows.find((r) => r.catalogItemId === id)?.menuClass
    expect(classOf(1)).toBe('star')
    expect(classOf(2)).toBe('plowhorse')
    expect(classOf(3)).toBe('puzzle')
    expect(classOf(4)).toBe('dog')
    expect(countClasses(result.rows)).toEqual({
      star: 1,
      plowhorse: 1,
      puzzle: 1,
      dog: 1,
    })
  })

  it('lists stars first and the biggest earners first within a class', () => {
    const result = toMenuEngineering(
      [...costs, row(5, 80, 20)],
      [...sales, sold(5, 40)]
    )
    expect(result.rows.slice(0, 2).map((r) => r.catalogItemId)).toEqual([5, 1])
  })

  it('leaves an item with an uncosted ingredient unplaced and out of the averages', () => {
    const result = toMenuEngineering(
      [...costs, row(9, 50, 1, 'incomplete')],
      [...sales, sold(9, 500)]
    )
    expect(result.averageMargin).toBe(28)
    const incomplete = result.rows.find((r) => r.catalogItemId === 9)
    expect(incomplete?.menuClass).toBeNull()
    expect(incomplete?.sold).toBe(500)
    expect(result.rows[result.rows.length - 1].catalogItemId).toBe(9)
  })

  it('places nothing when nothing sold', () => {
    const result = toMenuEngineering(costs, [])
    expect(result.noSales).toBe(true)
    expect(result.rows.every((r) => r.menuClass === null)).toBe(true)
  })

  it('adds up lines of the same item and skips lines with no item', () => {
    const result = toMenuEngineering(costs, [
      sold(1, 5),
      sold(1, 7),
      { ...sold(2, 3), catalogItemId: null },
    ])
    expect(result.rows.find((r) => r.catalogItemId === 1)?.sold).toBe(12)
    expect(result.rows.find((r) => r.catalogItemId === 2)?.sold).toBe(0)
  })
})
