import { describe, expect, it } from 'vitest'
import { allowedFilter } from './filter'

// The customer list narrows two ways, and each belongs to a module. A link
// saved when the café had both must not open a page that asks a service it
// no longer pays for.

const both = { tabs: true, loyalty: true }

describe('the list a link asks for', () => {
  it('is the one asked for while both modules are on', () => {
    expect(allowedFilter('owing', both)).toBe('owing')
    expect(allowedFilter('members', both)).toBe('members')
    expect(allowedFilter(undefined, both)).toBeUndefined()
  })

  it('is the whole list when house accounts are not in the plan', () => {
    expect(allowedFilter('owing', { tabs: false, loyalty: true })).toBeUndefined()
    expect(allowedFilter('members', { tabs: false, loyalty: true })).toBe('members')
  })

  it('is the whole list when loyalty is not in the plan', () => {
    expect(allowedFilter('members', { tabs: true, loyalty: false })).toBeUndefined()
    expect(allowedFilter('owing', { tabs: true, loyalty: false })).toBe('owing')
  })

  it('is the whole list for a café with neither', () => {
    expect(allowedFilter('owing', { tabs: false, loyalty: false })).toBeUndefined()
    expect(allowedFilter('members', { tabs: false, loyalty: false })).toBeUndefined()
  })
})
