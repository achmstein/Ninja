import { describe, expect, it } from 'vitest'
import { formatMoney } from './currency'

const plain = (text: string) => text.replace(/[⁦⁩]/g, '')

describe('formatMoney', () => {
  it('groups thousands with two decimals', () => {
    expect(plain(formatMoney(10820, 'EGP', 'en'))).toBe('10,820.00 EGP')
  })

  it('puts a true minus before a loss', () => {
    expect(plain(formatMoney(-10481.35, 'EGP', 'en'))).toBe('−10,481.35 EGP')
  })

  it('holds the figure left to right in Arabic', () => {
    const text = formatMoney(-5, 'EGP', 'ar')
    expect(text.startsWith('⁦−5.00⁩ ')).toBe(true)
  })

  it('reads a string and nothing as numbers', () => {
    expect(plain(formatMoney('1234.5', 'EGP', 'en'))).toBe('1,234.50 EGP')
    expect(plain(formatMoney(null, 'EGP', 'en'))).toBe('0.00 EGP')
  })
})
