import { describe, expect, it } from 'vitest'
import {
  boardOrder,
  cashDifference,
  deliveryOrderOfLabel,
  directionsUrl,
  distanceParts,
  formatAddressLine,
  laneOf,
  listSeparator,
  stageOf,
  telHref,
} from './delivery-format'

const words = { building: 'Bldg', floor: 'Floor', apartment: 'Apt' }

describe('formatAddressLine', () => {
  it('puts the street first and the parts after, in the language’s own list', () => {
    expect(formatAddressLine({ address: 'Tahrir St', building: '12', floor: '3' }, words, 'en')).toBe('Tahrir St · Bldg 12, Floor 3')
    expect(formatAddressLine({ address: 'Tahrir St', building: '12', floor: '3' }, { building: 'عمارة', floor: 'دور', apartment: 'شقة' }, 'ar')).toBe('Tahrir St · عمارة 12، دور 3')
  })

  it('is the street alone when nothing else was said', () => {
    expect(formatAddressLine({ address: ' Maadi ' }, words, 'en')).toBe('Maadi')
  })

  it('never says the Arabic comma in English', () => {
    expect(listSeparator('en')).toBe(', ')
    expect(listSeparator('ar')).toBe('، ')
  })
})

describe('distanceParts', () => {
  it('rounds to 10 m under a kilometre and a tenth above', () => {
    expect(distanceParts(4)).toEqual({ unit: 'm', value: 10 })
    expect(distanceParts(784)).toEqual({ unit: 'm', value: 780 })
    expect(distanceParts(2449)).toEqual({ unit: 'km', value: 2.4 })
  })
})

describe('directionsUrl', () => {
  it('goes to the pin when there is one, else searches the words', () => {
    expect(directionsUrl({ latitude: '30.06', longitude: 31.47, address: 'x' })).toBe('https://www.google.com/maps/dir/?api=1&destination=30.06,31.47')
    expect(directionsUrl({ latitude: null, longitude: null, address: 'Maadi, Road 9' })).toBe('https://www.google.com/maps/dir/?api=1&destination=Maadi%2C%20Road%209')
  })
})

describe('telHref', () => {
  it('keeps digits and a leading plus only', () => {
    expect(telHref(' +20 100-123 4567 ')).toBe('tel:+201001234567')
    expect(telHref('0100;javascript:alert(1)')).toBe('tel:01001')
    expect(telHref('')).toBeNull()
  })
})

describe('lanes', () => {
  const at = (stage: string, extra: Record<string, string | null> = {}) => ({ delivery: { stage, ...extra } })

  it('follows the server’s stage', () => {
    expect(laneOf(at('Waiting'))).toBe('waiting')
    expect(laneOf(at('Assigned'))).toBe('withRider')
    expect(laneOf(at('OnTheWay'))).toBe('withRider')
    expect(laneOf(at('Delivered'))).toBe('cashDue')
    expect(laneOf(at('Failed'))).toBe('failed')
    expect(laneOf(at('Returned'))).toBe('returned')
    expect(laneOf(at('Delivered', { cashHandedInAt: '2026-10-04T10:00:00Z' }))).toBe('done')
    expect(laneOf({ paidAt: '2026-10-04T10:00:00Z', delivery: { stage: 'Waiting' } })).toBe('done')
  })

  it('reads a stage it does not know as waiting rather than losing the delivery', () => {
    expect(stageOf('Teleported')).toBe('Waiting')
    expect(laneOf(at('Teleported'))).toBe('waiting')
  })

  it('orders the board by what needs the till first', () => {
    const orders = [at('Returned'), at('Delivered'), at('OnTheWay'), at('Failed'), at('Waiting'), at('Delivered', { cashHandedInAt: 'x' })]
    expect(boardOrder(orders).map((o) => o.delivery.stage)).toEqual(['Waiting', 'Failed', 'OnTheWay', 'Delivered', 'Returned'])
  })
})

describe('deliveryOrderOfLabel', () => {
  it('reads the order a delivery bill was opened for, and nothing from other bills', () => {
    expect(deliveryOrderOfLabel('#42 · Mona')).toBe(42)
    expect(deliveryOrderOfLabel('#7')).toBe(7)
    expect(deliveryOrderOfLabel('Table 4')).toBeNull()
    expect(deliveryOrderOfLabel('#4b · x')).toBeNull()
    expect(deliveryOrderOfLabel(null)).toBeNull()
  })
})

describe('cashDifference', () => {
  it('is collected minus due, to the piastre, and nothing before the cash is in', () => {
    expect(cashDifference(100, 95.5)).toBe(4.5)
    expect(cashDifference(90, 95.5)).toBe(-5.5)
    expect(cashDifference(null, 95.5)).toBeNull()
  })
})
