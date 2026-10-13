import { describe, expect, it } from 'vitest'
import type { DeliveryAlternative } from '@/api/ordering/types.gen'
import { emptyDelivery } from '@/features/sale/cart'
import { callerDelivery, chosenBranch, suggestedBranch } from './call-centre'

const branch = (branchId: number, paused = false): DeliveryAlternative => ({
  branchId,
  distanceMeters: 1000 * branchId,
  fee: 20,
  minimumOrder: 0,
  paused,
})

describe('suggestedBranch', () => {
  it('is the nearest branch that is not paused', () => {
    expect(suggestedBranch([branch(2), branch(1)])).toBe(2)
    expect(suggestedBranch([branch(2, true), branch(1)])).toBe(1)
  })

  it('is none when nobody delivers there or every branch is paused', () => {
    expect(suggestedBranch([])).toBeNull()
    expect(suggestedBranch([branch(2, true)])).toBeNull()
  })
})

describe('chosenBranch', () => {
  it('keeps the agent’s pick, a paused branch too', () => {
    expect(chosenBranch([branch(2), branch(3, true)], 3)).toBe(3)
  })

  it('falls back to the suggestion when the pick no longer delivers there', () => {
    expect(chosenBranch([branch(2), branch(3)], 7)).toBe(2)
    expect(chosenBranch([branch(2)], null)).toBe(2)
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
      { latitude: 29.96, longitude: 31.25 },
    )
    expect(delivery).toMatchObject({
      address: '9 Road 9',
      latitude: 29.96,
      longitude: 31.25,
      location: '29.96, 31.25',
      sendTo: null,
    })
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
