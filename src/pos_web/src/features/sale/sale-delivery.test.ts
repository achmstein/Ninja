import { describe, expect, it } from 'vitest'
import { emptyDelivery, type SaleDelivery } from './cart'
import {
  deliveryFeeOf,
  deliveryReadiness,
  keptSendTo,
  sendToBranchId,
  toPosDeliveryRequest,
  toSendTo,
  validatePhoneDelivery,
} from './sale-delivery'

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

describe('sending to the nearer branch', () => {
  const maadi = { branchId: '2', distanceMeters: 1200, fee: '25', minimumOrder: 100, paused: false }
  const sent = toSendTo(maadi)

  it('keeps the offer as numbers', () => {
    expect(sent).toEqual({ branchId: 2, fee: 25, minimumOrder: 100, distanceMeters: 1200, paused: false })
  })

  it('stays chosen while the pin stands and the branch is still offered, at its fee now', () => {
    expect(keptSendTo(sent, [{ ...maadi, fee: 30, paused: true }], true)).toEqual({ ...sent, fee: 30, paused: true })
  })

  it('is dropped when the pin changes or the branch is no longer offered', () => {
    expect(keptSendTo(sent, [maadi], false)).toBeNull()
    expect(keptSendTo(sent, [{ ...maadi, branchId: 3 }], true)).toBeNull()
    expect(keptSendTo(null, [maadi], true)).toBeNull()
  })

  it("charges the delivering branch's fee and names it on the order", () => {
    const delivery = { ...filled, sendTo: sent }
    expect(deliveryFeeOf(delivery, 20)).toBe(25)
    expect(deliveryFeeOf(filled, 20)).toBe(20)
    expect(sendToBranchId(delivery)).toBe(2)
    expect(sendToBranchId(filled)).toBeNull()
  })
})
