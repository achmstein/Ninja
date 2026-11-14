import { describe, expect, it } from 'vitest'
import { originNote, readOrigin } from './origin'

describe('where a visitor came from', () => {
  it('reads a campaign off the address', () => {
    expect(readOrigin('?utm_source=facebook&utm_medium=reel&utm_campaign=gaming', '', 'ninjapp.net', '/ar')).toEqual({
      source: 'facebook',
      medium: 'reel',
      campaign: 'gaming',
      landing: '/ar',
    })
  })

  it('reads the business that sent them, in small letters', () => {
    expect(readOrigin('?ref=Chillax', 'https://chillax.ninjapp.net/about', 'ninjapp.net', '/')).toEqual({
      ref: 'chillax',
      referrer: 'chillax.ninjapp.net',
      landing: '/',
    })
  })

  it('does not count our own pages as where they came from', () => {
    expect(readOrigin('', 'https://ninjapp.net/ar', 'ninjapp.net', '/')).toEqual({ landing: '/' })
  })

  it('survives a referrer that is not an address', () => {
    expect(readOrigin('', 'nonsense', 'ninjapp.net', '/')).toEqual({ landing: '/' })
  })

  it('cuts a tag to what is kept', () => {
    expect(readOrigin(`?utm_source=${'a'.repeat(200)}`, '', 'ninjapp.net', '/').source).toHaveLength(60)
  })
})

describe('the note on a WhatsApp message', () => {
  it('is empty when nothing is known', () => {
    expect(originNote({ landing: '/' })).toBe('')
  })
  it('names the business and the campaign', () => {
    expect(originNote({ ref: 'chillax', source: 'facebook' })).toBe(' (chillax, facebook)')
  })
})
