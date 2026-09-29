import { describe, expect, it } from 'vitest'
import { guestDetailsParams, hasWholeName, namePartsOf } from './identity'

describe('namePartsOf', () => {
  it('takes the profile’s own first and last name', () => {
    expect(namePartsOf({ name: 'Mona El Sayed', firstName: 'Mona', lastName: 'El Sayed' })).toEqual(['Mona', 'El Sayed'])
  })

  it('splits a whole name at its first space when the profile has no parts', () => {
    expect(namePartsOf({ name: 'Ahmed Nabil Hassan' })).toEqual(['Ahmed', 'Nabil Hassan'])
    expect(namePartsOf(null, 'Cher')).toEqual(['Cher', ''])
  })

  it('is empty with nothing to go on', () => {
    expect(namePartsOf(undefined)).toEqual(['', ''])
  })
})

describe('hasWholeName', () => {
  it('wants both a first and a last name', () => {
    expect(hasWholeName({ firstName: 'Mona', lastName: 'El Sayed' })).toBe(true)
    expect(hasWholeName({ name: 'Mona', firstName: 'Mona', lastName: '' })).toBe(false)
    expect(hasWholeName({ name: '', firstName: null, lastName: null })).toBe(false)
    expect(hasWholeName({ firstName: ' ', lastName: 'El Sayed' })).toBe(false)
    expect(hasWholeName(null)).toBe(false)
  })
})

describe('guestDetailsParams', () => {
  it('splits the name at its first space and keeps the phone', () => {
    expect(guestDetailsParams({ name: ' Ahmed Ali Hassan ', phone: ' 01012345678 ' })).toEqual({
      nj_first: 'Ahmed',
      nj_last: 'Ali Hassan',
      nj_phone: '01012345678',
    })
  })

  it('leaves out what is empty', () => {
    expect(guestDetailsParams({ name: 'Ahmed', phone: '' })).toEqual({ nj_first: 'Ahmed' })
  })
})
