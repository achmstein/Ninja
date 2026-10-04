import { describe, expect, it } from 'vitest'
import { emptyDelivery, type SaleDelivery } from './cart'
import { deliveryReadiness, toPosDeliveryRequest, validatePhoneDelivery } from './sale-delivery'

const filled: SaleDelivery = {
  ...emptyDelivery,
  address: ' Qasr El Nil St ',
  building: '12',
  floor: ' ',
  directions: 'Blue gate',
  phone: '0100 123 4567',
}

describe('validatePhoneDelivery', () => {
  it('asks for a name only when no account is attached', () => {
    expect(validatePhoneDelivery(filled, '', true)).toEqual({ name: true })
    expect(validatePhoneDelivery(filled, '', false)).toEqual({})
  })

  it('wants a phone the rider can call and an address', () => {
    expect(validatePhoneDelivery({ ...filled, phone: '12', address: ' ' }, 'Mona', true)).toEqual({ phone: true, address: true })
  })

  it('catches a part longer than the server keeps', () => {
    expect(validatePhoneDelivery({ ...filled, directions: 'x'.repeat(501) }, 'Mona', true)).toEqual({ tooLong: true })
  })
})

describe('toPosDeliveryRequest', () => {
  it('trims, sends blanks as nothing, and no pin when none was shared', () => {
    expect(toPosDeliveryRequest(filled)).toEqual({
      address: 'Qasr El Nil St',
      phone: '0100 123 4567',
      latitude: null,
      longitude: null,
      building: '12',
      floor: null,
      apartment: null,
      directions: 'Blue gate',
    })
  })

  it('sends the pin only when both coordinates are there', () => {
    expect(toPosDeliveryRequest({ ...filled, latitude: 30.06, longitude: 31.47 })).toMatchObject({ latitude: 30.06, longitude: 31.47 })
    expect(toPosDeliveryRequest({ ...filled, latitude: 30.06, longitude: null })).toMatchObject({ latitude: null, longitude: null })
  })
})

describe('deliveryReadiness', () => {
  const terms = { isLoading: false, isError: false, delivers: true }

  it('is nothing for a counter sale', () => {
    expect(deliveryReadiness(null, terms, true)).toBe('none')
  })

  it('never lets a delivery go out as a counter sale while the terms are unknown or off', () => {
    expect(deliveryReadiness(filled, { ...terms, isLoading: true }, true)).toBe('loading')
    expect(deliveryReadiness(filled, { ...terms, isError: true }, true)).toBe('failed')
    expect(deliveryReadiness(filled, { ...terms, delivers: false }, true)).toBe('off')
    expect(deliveryReadiness(filled, terms, false)).toBe('off')
    expect(deliveryReadiness(filled, terms, true)).toBe('ready')
  })
})
