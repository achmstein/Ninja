import { describe, expect, it } from 'vitest'
import { type PayLineView, type PayOptionsView } from '@/api/sales'
import {
  customShare,
  defaultParts,
  equalShare,
  guestFee,
  itemsShare,
  money,
  paySummary,
  tipFor,
} from './pay'

// A table pays its bill from their phones: the sums the sheet shows must be
// the ones Sales charges (OnlineShares), to the piaster.

const line = (id: number, share: number, extra: Partial<PayLineView> = {}): PayLineView => ({
  id,
  description: { en: `Item ${id}`, ar: null },
  details: null,
  qty: 1,
  total: share,
  share,
  claimed: false,
  isMine: false,
  ...extra,
})

const options = (extra: Partial<PayOptionsView> = {}): PayOptionsView => ({
  ready: true,
  currency: 'EGP',
  feeMode: 'Cafe',
  feePercent: 0,
  feeFixed: 0,
  tipsEnabled: true,
  tipPercents: [5, 10, 15],
  allowItems: true,
  allowEqual: true,
  allowCustom: true,
  card: true,
  wallet: true,
  applePay: false,
  ...extra,
})

describe('money', () => {
  it('rounds halves away from zero, as the decimal does', () => {
    expect(money(1.005)).toBe(1.01)
    expect(money(2.675)).toBe(2.68)
    expect(money(10.004)).toBe(10)
    expect(money(-1.005)).toBe(-1.01)
  })
})

describe('guestFee', () => {
  it('solves the fee so the provider keeps what it covers', () => {
    // (100 + 3) / (1 - 0.0275) = 105.9125… → fee 5.91
    expect(guestFee(100, 2.75, 3)).toBe(5.91)
    expect(guestFee(250.5, 2.5, 0)).toBe(6.42)
  })

  it('is nothing with no fee or no amount', () => {
    expect(guestFee(100, 0, 0)).toBe(0)
    expect(guestFee(0, 2.75, 3)).toBe(0)
  })
})

describe('equalShare', () => {
  it('pays parts of the total', () => {
    expect(equalShare(300, 300, 1, 3)).toBe(100)
    expect(equalShare(300, 300, 2, 3)).toBe(200)
  })

  it('leaves the rounding to the last share', () => {
    // 100 / 3 = 33.33 each; the last one takes 33.34
    expect(equalShare(100, 100, 1, 3)).toBe(33.33)
    expect(equalShare(100, 33.34, 1, 3)).toBe(33.34)
  })

  it('never goes past what is left', () => {
    expect(equalShare(300, 50, 1, 2)).toBe(50)
    expect(equalShare(300, 0, 1, 2)).toBe(0)
  })
})

describe('itemsShare', () => {
  const lines = [line(1, 40.1), line(2, 30.05), line(3, 29.84, { claimed: true })]

  it('adds the picked lines at their share', () => {
    expect(itemsShare(lines, new Set(['1']), 70.16)).toBe(40.1)
  })

  it('gives the last free lines whatever is left', () => {
    expect(itemsShare(lines, new Set(['1', '2']), 70.16)).toBe(70.16)
  })

  it('skips claimed lines and caps at what is left', () => {
    expect(itemsShare(lines, new Set(['3']), 70.16)).toBe(0)
    expect(itemsShare(lines, new Set(['1']), 20)).toBe(20)
  })
})

describe('customShare', () => {
  it('reads what the guest typed, Arabic digits too', () => {
    expect(customShare('12.345')).toBe(12.35)
    expect(customShare('12,5')).toBe(12.5)
    expect(customShare('٤٥')).toBe(45)
    expect(customShare('')).toBe(0)
    expect(customShare('-3')).toBe(0)
  })
})

describe('paySummary', () => {
  it('adds the tip, and no fee when the café absorbs it', () => {
    expect(paySummary(100, tipFor(100, 10), options())).toEqual({
      share: 100,
      tip: 10,
      fee: 0,
      total: 110,
    })
  })

  it('puts the fee on share and tip when the guest pays it', () => {
    const s = paySummary(90, 10, options({ feeMode: 'Guest', feePercent: 2.75, feeFixed: 3 }))
    expect(s.fee).toBe(5.91)
    expect(s.total).toBe(105.91)
  })
})

describe('defaultParts', () => {
  it('starts from the party where known, else two', () => {
    expect(defaultParts(4)).toBe(4)
    expect(defaultParts(null)).toBe(2)
    expect(defaultParts(1)).toBe(2)
    expect(defaultParts(80)).toBe(50)
  })
})
