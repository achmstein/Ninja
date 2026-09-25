import { describe, expect, it } from 'vitest'
import {
  internationalDigits,
  latinDigits,
  normalizeName,
  normalizePhone,
  whatsAppLink,
} from './phone'

describe('normalizePhone', () => {
  it.each([
    ['01012345678', '01012345678'],
    ['010 1234 5678', '01012345678'],
    ['010-1234-5678', '01012345678'],
    ['(010) 1234.5678', '01012345678'],
    ['+20 10 1234 5678', '01012345678'],
    ['+20 010 1234 5678', '01012345678'],
    ['0020 1012345678', '01012345678'],
    ['201012345678', '01012345678'],
    ['1012345678', '01012345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '01012345678'],
    ['+٢٠ ١٠ ١٢٣٤ ٥٦٧٨', '01012345678'],
    ['۰۱۰۱۲۳۴۵۶۷۸', '01012345678'],
  ])('reads %s as one Egyptian mobile', (typed, expected) => {
    expect(normalizePhone(typed, 'EG')).toBe(expected)
  })

  it('turns a Gulf country code back into its trunk zero', () => {
    expect(normalizePhone('+966 51 234 5678', 'SA')).toBe('0512345678')
    expect(normalizePhone('512345678', 'SA')).toBe('0512345678')
    expect(normalizePhone('00971501234567', 'AE')).toBe('0501234567')
  })

  it('keeps an international number elsewhere', () => {
    expect(normalizePhone('+44 7700 900123', 'GB')).toBe('+447700900123')
    expect(normalizePhone('0044 7700 900123', 'GB')).toBe('+447700900123')
  })

  it('is empty when nothing number-like was typed', () => {
    expect(normalizePhone('  ', 'EG')).toBe('')
    expect(normalizePhone('ahmed', 'EG')).toBe('')
  })
})

describe('whatsApp', () => {
  it('puts the country code in front of a local number', () => {
    expect(internationalDigits('01012345678', 'EG')).toBe('201012345678')
    expect(internationalDigits('0512345678', 'SA')).toBe('966512345678')
    expect(internationalDigits('0501234567', 'AE')).toBe('971501234567')
    expect(internationalDigits('+447700900123', 'EG')).toBe('447700900123')
  })

  it('carries a message', () => {
    expect(whatsAppLink('01012345678', 'EG', 'hi there')).toBe(
      'https://wa.me/201012345678?text=hi%20there'
    )
  })
})

describe('latinDigits', () => {
  it('reads Arabic-Indic digits', () => {
    expect(latinDigits('٠١٢٣٤٥٦٧٨٩ ۰۹')).toBe('0123456789 09')
  })
})

describe('normalizeName', () => {
  it('unifies Arabic letter variants and drops harakat and tatweel', () => {
    expect(normalizeName('أحمد')).toBe('احمد')
    expect(normalizeName('إحمد')).toBe('احمد')
    expect(normalizeName('آمنة')).toBe('امنه')
    expect(normalizeName('مصطفى')).toBe('مصطفي')
    expect(normalizeName('مُحَمَّد')).toBe('محمد')
    expect(normalizeName('محـــمد')).toBe('محمد')
  })

  it('ignores case, accents and hyphens', () => {
    expect(normalizeName('  El-Hady  Zoë ')).toBe('el hady zoe')
  })
})
