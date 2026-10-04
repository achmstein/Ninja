import { describe, expect, it } from 'vitest'
import { formatAddressLine, labelKind, listSeparator, shownLabel, storedLabel } from './address-line'

const words = { building: 'Bldg', floor: 'Floor', apartment: 'Apt' }

describe('formatAddressLine', () => {
  it('puts the street first and the parts after, in the language’s own list', () => {
    expect(formatAddressLine({ address: 'Tahrir St', building: '12', floor: '3' }, words, 'en')).toBe('Tahrir St · Bldg 12, Floor 3')
    expect(formatAddressLine({ address: 'Tahrir St', building: '12', apartment: '7' }, { building: 'عمارة', floor: 'دور', apartment: 'شقة' }, 'ar')).toBe(
      'Tahrir St · عمارة 12، شقة 7',
    )
  })

  it('is the street alone when nothing else was said', () => {
    expect(formatAddressLine({ address: 'Maadi' }, words, 'en')).toBe('Maadi')
  })

  it('never says the Arabic comma in English', () => {
    expect(listSeparator('en')).toBe(', ')
    expect(listSeparator('ar')).toBe('، ')
  })
})

describe('labels', () => {
  it('keeps Home and Work as their kind, whatever the language they were saved in', () => {
    expect(labelKind('home')).toBe('home')
    expect(labelKind('Home')).toBe('home')
    expect(labelKind('البيت')).toBe('home')
    expect(labelKind('الشغل')).toBe('work')
    expect(labelKind('Mum’s')).toBe('other')
  })

  it('stores the kind’s word and shows it in the customer’s language', () => {
    expect(storedLabel('home', 'ignored')).toBe('home')
    expect(storedLabel('other', '  ')).toBeNull()
    expect(shownLabel('home', { home: 'البيت', work: 'الشغل' })).toBe('البيت')
    expect(shownLabel('Home', { home: 'البيت', work: 'الشغل' })).toBe('البيت')
    expect(shownLabel('Mum’s', { home: 'Home', work: 'Work' })).toBe('Mum’s')
  })
})
