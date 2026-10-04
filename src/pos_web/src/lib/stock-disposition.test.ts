import { describe, expect, it } from 'vitest'
import { defaultDisposition, defaultDispositionFor, orderIdsOn } from './stock-disposition'

describe('defaultDisposition', () => {
  it('writes made food off and puts the rest back', () => {
    expect(defaultDisposition(true)).toBe('Waste')
    expect(defaultDisposition(false)).toBe('Restock')
    expect(defaultDisposition(undefined)).toBe('Restock')
    expect(defaultDisposition(null)).toBe('Restock')
  })

  it('treats a bill as made once any of its orders was', () => {
    expect(defaultDispositionFor([false, true])).toBe('Waste')
    expect(defaultDispositionFor([false, undefined])).toBe('Restock')
    expect(defaultDispositionFor([])).toBe('Restock')
  })
})

describe('orderIdsOn', () => {
  it('lists each order once and skips manual lines', () => {
    expect(orderIdsOn([{ orderId: 41 }, { orderId: '41' }, { orderId: null }, {}, { orderId: 42 }])).toEqual([41, 42])
  })
})
