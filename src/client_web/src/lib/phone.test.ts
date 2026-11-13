import { describe, expect, it } from 'vitest'
import {
  formatPhone,
  isValidPhone,
  normalizePhone,
  telHref,
} from './phone'

// The same cases as the server's PhoneRulesTest: one rule, four places
describe('normalizePhone', () => {
  it.each([
    '01012345678',
    '010 1234 5678',
    '010-1234-5678',
    '(010) 1234.5678',
    '+20 10 1234 5678',
    '+20 010 1234 5678',
    '0020 1012345678',
    '201012345678',
    '1012345678',
    '+0201012345678',
    '+201012345678',
    '٠١٠١٢٣٤٥٦٧٨',
    '+٢٠ ١٠ ١٢٣٤ ٥٦٧٨',
    '۰۱۰۱۲۳۴۵۶۷۸',
  ])('reads an Egyptian mobile typed as %s', (typed) => {
    expect(normalizePhone(typed, 'EG')).toBe('+201012345678')
    expect(isValidPhone(typed, 'EG')).toBe(true)
  })

  it.each(['1110970097', '01110970097', '+20 111 097 0097', '+0201110970097'])(
    "takes what a phone's autofill hands over: %s",
    (filled) => {
      expect(normalizePhone(filled, 'EG')).toBe('+201110970097')
    }
  )

  it('reads a number against its own country', () => {
    expect(normalizePhone('+966 51 234 5678', 'SA')).toBe('+966512345678')
    expect(normalizePhone('512345678', 'SA')).toBe('+966512345678')
    expect(normalizePhone('051 234 5678', 'SA')).toBe('+966512345678')
    expect(normalizePhone('00971501234567', 'AE')).toBe('+971501234567')
    expect(normalizePhone('07400 123456', 'GB')).toBe('+447400123456')
    expect(normalizePhone('0044 7400 123456', 'gb')).toBe('+447400123456')
  })

  it("takes only a mobile of the business's country", () => {
    expect(isValidPhone('+44 7400 123456', 'EG')).toBe(false)
    expect(isValidPhone('0512345678', 'EG')).toBe(false)
    expect(isValidPhone('01012345678', 'SA')).toBe(false)
    expect(isValidPhone('02 2345 6789', 'EG')).toBe(false)
    expect(isValidPhone('02012345678', 'EG')).toBe(false)
    expect(isValidPhone('0100', 'EG')).toBe(false)
    expect(isValidPhone('not-a-number', 'EG')).toBe(false)
    expect(isValidPhone('', 'EG')).toBe(false)
    expect(isValidPhone(null, 'EG')).toBe(false)
  })

  it('gives back what is not a number here without its separators', () => {
    expect(normalizePhone('  ', 'EG')).toBe('')
    expect(normalizePhone('ahmed', 'EG')).toBe('')
    expect(normalizePhone('010-1', 'EG')).toBe('0101')
    expect(normalizePhone('+44 7400 123456', 'EG')).toBe('+447400123456')
  })

  it('takes any real mobile with its code where the country is not known', () => {
    expect(normalizePhone('+44 7400 123456', 'ZZ')).toBe('+447400123456')
    expect(isValidPhone('07400 123456', 'ZZ')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('shows a kept number the way the country writes it', () => {
    expect(formatPhone('+201012345678', 'EG')).toBe('010 12345678')
    expect(formatPhone('01012345678', 'EG')).toBe('010 12345678')
    expect(formatPhone('+20223456789', 'EG')).toBe('02 23456789')
    expect(formatPhone('+447400123456', 'EG')).toBe('+44 7400 123456')
  })

  it('leaves what is not a number as it is', () => {
    expect(formatPhone('19019', 'EG')).toBe('19019')
    expect(formatPhone('ask Ahmed', 'EG')).toBe('ask Ahmed')
    expect(formatPhone(null, 'EG')).toBe('')
  })
})

describe('telHref', () => {
  it('dials the international form', () => {
    expect(telHref('+201012345678', 'EG')).toBe('tel:+201012345678')
    expect(telHref('010 1234 5678', 'EG')).toBe('tel:+201012345678')
    expect(telHref('19019', 'EG')).toBe('tel:19019')
  })
})
