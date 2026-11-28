import { describe, expect, it } from 'vitest'
import type { DeliveryAlternative, StaffDeliveryZone } from '@/api/ordering/types.gen'
import { emptyDelivery } from '@/features/sale/cart'
import { areaById, branchOffers, callerDelivery, chosenArea, offeredBranch, pinArea } from './call-centre'

const branch = (branchId: number, paused = false): DeliveryAlternative => ({
  branchId,
  distanceMeters: 1000 * branchId,
  fee: 20,
  minimumOrder: 0,
  paused,
})

const delivering = (branchId: number, paused = false) => ({ branchId, fee: 15, minimumOrder: 0, paused })

describe('branchOffers', () => {
  it('offers the branches whose area takes the point in, nearest first, when the map chose', () => {
    const { offers, byHand } = branchOffers([branch(2), branch(1)], [delivering(1), delivering(2), delivering(3)])
    expect(byHand).toBe(false)
    expect(offers.map((b) => b.branchId)).toEqual([2, 1])
    expect(offers[0]).toMatchObject({ distanceMeters: 2000, fee: 20 })
  })

  it('offers every branch that delivers, to pick by hand, with no point on the map or none reaching it', () => {
    const { offers, byHand } = branchOffers([], [delivering(1), delivering(3, true)])
    expect(byHand).toBe(true)
    expect(offers).toEqual([
      { branchId: 1, fee: 15, distanceMeters: null, paused: false },
      { branchId: 3, fee: 15, distanceMeters: null, paused: true },
    ])
    expect(branchOffers([], []).offers).toEqual([])
  })
})

describe('offeredBranch', () => {
  const near = branchOffers([branch(2), branch(3, true)], []).offers
  const all = branchOffers([], [delivering(1), delivering(3)]).offers

  it('keeps the agent’s pick, a paused branch too', () => {
    expect(offeredBranch(near, false, 3)).toBe(3)
    expect(offeredBranch(all, true, 3)).toBe(3)
  })

  it('suggests the nearest open branch when the map chose', () => {
    expect(offeredBranch(near, false, null)).toBe(2)
    expect(offeredBranch(near, false, 7)).toBe(2)
    expect(offeredBranch(branchOffers([branch(2, true)], []).offers, false, null)).toBeNull()
  })

  it('guesses nothing when the agent picks by hand, unless only one branch delivers', () => {
    expect(offeredBranch(all, true, null)).toBeNull()
    expect(offeredBranch(branchOffers([], [delivering(4)]).offers, true, null)).toBe(4)
    expect(offeredBranch(branchOffers([], [delivering(4, true)]).offers, true, null)).toBeNull()
  })
})

describe('callerDelivery', () => {
  it('carries the pin as coordinates and goes to no other branch', () => {
    const delivery = callerDelivery(
      {
        ...emptyDelivery,
        address: ' 9 Road 9 ',
        location: 'https://maps.app.goo.gl/x',
        sendTo: {
          branchId: 4,
          fee: 1,
          minimumOrder: 0,
          distanceMeters: 1,
          paused: false,
        },
      },
      { latitude: 29.96, longitude: 31.25 }
    )
    expect(delivery).toMatchObject({
      address: '9 Road 9',
      latitude: 29.96,
      longitude: 31.25,
      location: '29.96, 31.25',
      sendTo: null,
    })
  })

  it('carries the named area the agent picked, and none when there is none', () => {
    const zone = { id: 7, name: { en: 'Maadi Degla', ar: null }, fee: 35, minimumOrder: 0, etaMinutes: null }
    expect(callerDelivery({ ...emptyDelivery, address: 'Road 9', zone }, null)).toMatchObject({ zone, sendTo: null })
    const { zone: _zone, ...before } = emptyDelivery
    expect(callerDelivery({ ...before, address: 'Road 9' }, null).zone).toBeNull()
  })

  it('keeps the words alone without a pin', () => {
    const delivery = callerDelivery({ ...emptyDelivery, address: 'Maadi road 9', location: ' ' }, null)
    expect(delivery).toMatchObject({
      latitude: null,
      longitude: null,
      location: '',
    })
  })
})

describe('named areas', () => {
  const area = (zoneId: number, branchId: number, on = true): StaffDeliveryZone => ({
    zoneId,
    branchId,
    name: { en: `Area ${zoneId}`, ar: null },
    fee: 30,
    minimumOrder: 0,
    etaMinutes: null,
    on,
    branchPaused: false,
    drawn: true,
  })
  const zones = [area(7, 2), area(8, 2, false), area(9, 3)]

  it('finds an area by its id while it is listed', () => {
    expect(areaById(zones, 9)?.branchId).toBe(3)
    expect(areaById(zones, 4)).toBeNull()
    expect(areaById(zones, null)).toBeNull()
  })

  it('reads the area the map point is in at the branch that makes it', () => {
    const reaching = [{ ...branch(2), zoneId: 7 }, { ...branch(3), zoneId: '9' }, branch(4)]
    expect(pinArea(reaching, zones, 2)?.zoneId).toBe(7)
    expect(pinArea(reaching, zones, 3)?.zoneId).toBe(9)
    expect(pinArea(reaching, zones, 4)).toBeNull()
    expect(pinArea(reaching, zones, null)).toBeNull()
    expect(pinArea([{ ...branch(2), zoneId: 9 }], zones, 2)).toBeNull()
  })

  it('goes by the area picked by name before the one on the map', () => {
    expect(chosenArea(zones, 9, zones[0], false)?.zoneId).toBe(9)
    expect(chosenArea(zones, 8, zones[0], false)?.zoneId).toBe(8)
  })

  it('takes the area on the map when none was picked, unless it is off or the agent took it off', () => {
    expect(chosenArea(zones, null, zones[0], false)?.zoneId).toBe(7)
    expect(chosenArea(zones, null, zones[1], false)).toBeNull()
    expect(chosenArea(zones, null, zones[0], true)).toBeNull()
    expect(chosenArea(zones, null, null, false)).toBeNull()
  })

  it('falls back to the map once the area picked by name is no longer listed', () => {
    expect(chosenArea(zones, 4, zones[0], false)?.zoneId).toBe(7)
  })
})
