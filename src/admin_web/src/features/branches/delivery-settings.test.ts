import { describe, expect, it } from 'vitest'
import { parseDeliverySettings, stopsDelivering } from './delivery-settings'

describe('parseDeliverySettings', () => {
  it('reads the numbers as typed, a blank as not set and a decimal comma as a point', () => {
    expect(parseDeliverySettings({ radius: '2,5', fee: '', minimum: ' 100 ' })).toEqual({
      ok: true,
      value: { radius: 2.5, fee: 0, minimum: 100 },
    })
  })

  it('says which fields are wrong instead of saving them', () => {
    expect(parseDeliverySettings({ radius: '150', fee: '-5', minimum: 'abc' })).toEqual({
      ok: false,
      errors: { radius: true, fee: true, minimum: true },
    })
  })
})

describe('stopsDelivering', () => {
  it('is true only for a delivering branch left without a radius', () => {
    expect(stopsDelivering(true, { radius: 0, fee: 20, minimum: 0 })).toBe(true)
    expect(stopsDelivering(true, { radius: 3, fee: 20, minimum: 0 })).toBe(false)
    expect(stopsDelivering(false, { radius: 0, fee: 20, minimum: 0 })).toBe(false)
  })
})
