import { describe, expect, it } from 'vitest'
import { emptyDelivery, type SaleDelivery } from './cart'
import {
  chargedZone,
  deliveryFeeOf,
  deliveryReadiness,
  keptSendTo,
  sendToBranchId,
  toPosDeliveryRequest,
  toSaleZone,
  toSendTo,
  validateDeliveryWhere,
  validateDeliveryWho,
  validatePhoneDelivery,
  zoneGone,
  zoneIn,
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

describe('validateDeliveryWho', () => {
  it('wants a callable number, and a name unless an account gives one', () => {
    expect(validateDeliveryWho('0100 123 4567', '', true)).toEqual({ name: true })
    expect(validateDeliveryWho('0100 123 4567', '', false)).toEqual({})
    expect(validateDeliveryWho('12', 'Mona', true)).toEqual({ phone: true })
  })
})

describe('validateDeliveryWhere', () => {
  it('takes any street in the caller words, with no pin', () => {
    expect(validateDeliveryWhere({ ...filled, address: 'Haret El Sheikh, behind the bakery', location: '' })).toEqual({})
  })

  it('wants a street, and nothing longer than the server keeps; never the phone or name', () => {
    expect(validateDeliveryWhere({ ...filled, address: ' ', phone: '' })).toEqual({ address: true })
    expect(validateDeliveryWhere({ ...filled, floor: 'x'.repeat(51) })).toEqual({ tooLong: true })
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
      zoneId: null,
    })
  })

  it('sends the pin only when both coordinates are there', () => {
    expect(toPosDeliveryRequest({ ...filled, latitude: 30.06, longitude: 31.47 })).toMatchObject({ latitude: 30.06, longitude: 31.47 })
    expect(toPosDeliveryRequest({ ...filled, latitude: 30.06, longitude: null })).toMatchObject({ latitude: null, longitude: null })
  })
})

describe('a named area', () => {
  const listed = {
    zoneId: '7',
    branchId: 1,
    name: { en: 'Maadi Degla', ar: null },
    fee: '35',
    minimumOrder: 150,
    etaMinutes: '40',
    on: true,
    branchPaused: false,
    drawn: false,
  }
  const degla = toSaleZone(listed)
  const sendTo = { branchId: 2, fee: 25, minimumOrder: 0, distanceMeters: 900, paused: false }

  it('is kept as numbers, with its name in both languages', () => {
    expect(degla).toEqual({ id: 7, name: { en: 'Maadi Degla', ar: null }, fee: 35, minimumOrder: 150, etaMinutes: 40 })
    expect(toSaleZone({ ...listed, etaMinutes: null }).etaMinutes).toBeNull()
  })

  it('is found in the list the server sent, and not once the owner removed it', () => {
    expect(zoneIn([listed], 7)).toEqual(degla)
    expect(zoneIn([listed], 8)).toBeNull()
    expect(zoneIn(null, 7)).toBeNull()
    expect(zoneIn([listed], null)).toBeNull()
  })

  it('goes on the order by its id, the one the cashier picked by name', () => {
    expect(toPosDeliveryRequest({ ...filled, zone: degla })).toMatchObject({ zoneId: 7 })
  })

  it('does not follow an order sent to another branch', () => {
    expect(toPosDeliveryRequest({ ...filled, zone: degla, sendTo })).toMatchObject({ zoneId: null })
    expect(chargedZone({ ...filled, zone: degla, sendTo })).toBeNull()
    expect(chargedZone({ ...filled, zone: degla })).toEqual(degla)
  })

  it('is none on a sale kept before areas were', () => {
    const { zone: _zone, ...before } = filled
    expect(chargedZone(before)).toBeNull()
    expect(chargedZone(null)).toBeNull()
    expect(toPosDeliveryRequest(before)).toMatchObject({ zoneId: null })
  })

  it('is charged at the fee the branch answers for it: the area’s, or the other branch’s when sent on', () => {
    expect(deliveryFeeOf({ ...filled, zone: degla }, 35)).toBe(35)
    expect(deliveryFeeOf({ ...filled, zone: degla, sendTo }, 35)).toBe(25)
  })

  it('is gone when the terms asked for it name another area or none', () => {
    expect(zoneGone(degla, 7)).toBe(false)
    expect(zoneGone(degla, '7')).toBe(false)
    expect(zoneGone(degla, null)).toBe(true)
    expect(zoneGone(degla, undefined)).toBe(true)
    expect(zoneGone(degla, 9)).toBe(true)
    expect(zoneGone(null, null)).toBe(false)
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
