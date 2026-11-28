import { describe, expect, it } from 'vitest'
import { isArabic, leadOrigin, whatsappNumber } from './lead'

const none = { ref: null, source: null, medium: null, campaign: null, referrer: null }

describe('leadOrigin', () => {
  it('says nothing when nothing is known', () => {
    expect(leadOrigin(none)).toBeNull()
  })
  it('names the business that sent them before anything else', () => {
    expect(leadOrigin({ ...none, ref: 'chillax', referrer: 'chillax.ninjapp.net' })).toBe('recommended by chillax')
  })
  it('joins the campaign tags and leaves the referrer out', () => {
    expect(
      leadOrigin({ ...none, source: 'facebook', medium: 'reel', campaign: 'gaming', referrer: 'l.facebook.com' })
    ).toBe('facebook / reel / gaming')
  })
  it('falls back to the site before ours', () => {
    expect(leadOrigin({ ...none, referrer: 'google.com' })).toBe('google.com')
  })
})

describe('whatsappNumber', () => {
  it('gives a local Egyptian number its country code', () => {
    expect(whatsappNumber('01110970097')).toBe('201110970097')
  })
  it('keeps a number that already has one', () => {
    expect(whatsappNumber('+201110970097')).toBe('201110970097')
    expect(whatsappNumber('00966501234567')).toBe('966501234567')
  })
})

describe('isArabic', () => {
  it('tells an Arabic name from a Latin one', () => {
    expect(isArabic('كافيه ميلو')).toBe(true)
    expect(isArabic('Mellow Café')).toBe(false)
  })
})
