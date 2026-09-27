import { describe, expect, it } from 'vitest'
import { namePartsOf } from './identity'

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
