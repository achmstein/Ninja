import { describe, expect, it } from 'vitest'
import { googleWebKey, nearParam, newSearchSession, searchable } from './address-search'

describe('searchable', () => {
  it('waits for three letters, trimmed and single-spaced', () => {
    expect(searchable('  st ')).toBeNull()
    expect(searchable('  شارع   9 ')).toBe('شارع 9')
  })
})

describe('newSearchSession', () => {
  it('is a token Google takes: 36 characters, URL-safe, different each time', () => {
    const a = newSearchSession()
    expect(a).toMatch(/^[A-Za-z0-9-]{36}$/)
    expect(newSearchSession()).not.toBe(a)
  })
})

describe('nearParam', () => {
  it('is lat,lng to about a metre, or nothing', () => {
    expect(nearParam({ lat: 30.044412345, lng: 31.2357 })).toBe('30.04441,31.23570')
    expect(nearParam(null)).toBeUndefined()
  })
})

describe('googleWebKey', () => {
  const maps = { search: true, webKey: 'browser-key', webDomains: ['ninjapp.net', 'menu.blue.com'] }

  it('is the key on a host the key lists, the platform subdomains included', () => {
    expect(googleWebKey(maps, 'blue.ninjapp.net')).toBe('browser-key')
    expect(googleWebKey(maps, 'admin.blue.ninjapp.net')).toBe('browser-key')
    expect(googleWebKey(maps, 'MENU.blue.com')).toBe('browser-key')
  })

  it('keeps the free map elsewhere, or with the web map off', () => {
    expect(googleWebKey(maps, 'blue.com')).toBeNull()
    expect(googleWebKey(maps, 'evilninjapp.net')).toBeNull()
    expect(googleWebKey({ ...maps, webKey: null }, 'blue.ninjapp.net')).toBeNull()
    expect(googleWebKey(undefined, 'blue.ninjapp.net')).toBeNull()
  })
})
