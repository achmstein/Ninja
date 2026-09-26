import { describe, expect, it } from 'vitest'
import type { CartLine } from '@/lib/cart'
import { odometerRuns } from './odometer-runs'
import { flightPath, swipeRemoves, trayOpensAfterDrag, traySummary } from './tray-model'

const line = (productId: number, quantity = 1, price = 10, x: Partial<CartLine> = {}): CartLine => ({
  productId,
  nameEn: `Item ${productId}`,
  nameAr: '',
  price,
  quantity,
  customizations: [],
  pictureUrl: `/pic/${productId}`,
  ...x,
})

describe('traySummary', () => {
  it('counts and totals every line, the newest first, the rest as a number', () => {
    const summary = traySummary([line(1, 2, 25), line(2), line(3), line(4), line(5, 1, 40)], 3)
    expect(summary.count).toBe(6)
    expect(summary.total).toBe(50 + 10 + 10 + 10 + 40)
    expect(summary.thumbs.map((t) => t.name)).toEqual(['Item 5', 'Item 4', 'Item 3'])
    expect(summary.more).toBe(2)
  })

  it('is empty for an empty cart', () => {
    expect(traySummary([])).toEqual({ thumbs: [], more: 0, count: 0, total: 0 })
  })
})

describe('swipeRemoves', () => {
  it('removes a line swiped far enough either way, or flicked', () => {
    expect(swipeRemoves(150, 320, 0)).toBe(true)
    expect(swipeRemoves(-150, 320, 0)).toBe(true)
    expect(swipeRemoves(60, 320, 0)).toBe(false)
    expect(swipeRemoves(40, 320, -900)).toBe(true)
    expect(swipeRemoves(100, 0, 0)).toBe(false)
  })
})

describe('trayOpensAfterDrag', () => {
  it('opens when dragged or flicked up, and stays shut otherwise', () => {
    expect(trayOpensAfterDrag(false, -80, 0)).toBe(true)
    expect(trayOpensAfterDrag(false, -10, -500)).toBe(true)
    expect(trayOpensAfterDrag(false, -20, 0)).toBe(false)
  })

  it('closes when dragged or flicked down, and stays open otherwise', () => {
    expect(trayOpensAfterDrag(true, 80, 0)).toBe(false)
    expect(trayOpensAfterDrag(true, 5, 600)).toBe(false)
    expect(trayOpensAfterDrag(true, 20, 0)).toBe(true)
  })
})

describe('flightPath', () => {
  it('moves centre to centre and scales to the landing size', () => {
    const path = flightPath({ x: 16, y: 100, width: 358, height: 500 }, { x: 20, y: 760, width: 44, height: 44 })
    expect(path.dx).toBeCloseTo(20 + 22 - (16 + 179))
    expect(path.dy).toBeCloseTo(760 + 22 - (100 + 250))
    expect(path.scale).toBeCloseTo(44 / 358)
  })
})

describe('odometerRuns', () => {
  it('keeps a price whole as one number, and the currency as text', () => {
    const runs = odometerRuns('125.50 EGP')
    expect(runs).toHaveLength(2)
    expect(runs[0].kind).toBe('number')
    expect(runs[1]).toEqual({ kind: 'text', value: ' EGP' })
    const digits = runs[0].kind === 'number' ? runs[0].cells.map((c) => (c.kind === 'digit' ? c.value : c.value)) : []
    expect(digits).toEqual([1, 2, 5, '.', 5, 0])
  })

  it('rolls Arabic-Indic digits on their own wheels', () => {
    const runs = odometerRuns('٢٥٫٠٠ ج.م')
    expect(runs[0].kind).toBe('number')
    if (runs[0].kind === 'number') {
      expect(runs[0].cells[0]).toMatchObject({ kind: 'digit', value: 2, digits: '٠١٢٣٤٥٦٧٨٩' })
      expect(runs[0].cells[2]).toEqual({ kind: 'mark', value: '٫' })
    }
    expect(runs[1]).toEqual({ kind: 'text', value: ' ج.م' })
  })

  it('treats a dot in the currency label as text', () => {
    const runs = odometerRuns('ج.م 5')
    expect(runs.map((r) => r.kind)).toEqual(['text', 'number'])
  })
})
