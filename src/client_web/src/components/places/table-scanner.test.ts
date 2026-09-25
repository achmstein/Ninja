import { describe, expect, it } from 'vitest'
import { placeIdFromCode } from './table-scanner'

describe('placeIdFromCode', () => {
  const origin = 'https://akti.ninjapp.net'

  it('reads a table link of this café', () => {
    expect(placeIdFromCode('https://akti.ninjapp.net/p/12', origin)).toBe(12)
    expect(placeIdFromCode(' https://akti.ninjapp.net/p/7/ ', origin)).toBe(7)
  })

  it('refuses another café, another page, or no link at all', () => {
    expect(placeIdFromCode('https://hotspot.ninjapp.net/p/12', origin)).toBeNull()
    expect(placeIdFromCode('https://akti.ninjapp.net/bills', origin)).toBeNull()
    expect(placeIdFromCode('WIFI:S:cafe;P:secret;;', origin)).toBeNull()
  })
})
