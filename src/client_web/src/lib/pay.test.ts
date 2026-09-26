import { describe, expect, it } from 'vitest'
import { type PayLineView, type PayOptionsView } from '@/api/sales'
import {
  customShare,
  defaultParts,
  equalShare,
  guestFee,
  itemsShare,
  money,
  minSeats,
  paySummary,
  pickedSeats,
  quickAmounts,
  seatPlan,
  sliderAmount,
  sliderPosition,
  sliderStep,
  sliderSteps,
  startSeats,
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
  it('charges the share alone when the café absorbs the fee', () => {
    expect(paySummary(100, options())).toEqual({
      share: 100,
      fee: 0,
      total: 100,
    })
  })

  it('puts the fee on the share when the guest pays it', () => {
    const s = paySummary(100, options({ feeMode: 'Guest', feePercent: 2.75, feeFixed: 3 }))
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

describe('seats', () => {
  it('starts from the party, never fewer than those who paid plus the guest', () => {
    expect(startSeats(4, 0)).toBe(4)
    expect(startSeats(null, 0)).toBe(2)
    expect(startSeats(2, 3)).toBe(4)
    expect(startSeats(30, 0)).toBe(12)
    expect(minSeats(0)).toBe(2)
    expect(minSeats(20)).toBe(12)
  })

  it('fills the table from what is paid and being paid, keeping a seat free', () => {
    // 408.20 over 5 = 81.64 each; 81.64 paid is one seat, 90 held is one
    expect(seatPlan(408.2, 81.64, 90, 5)).toEqual({ perPerson: 81.64, paid: 1, held: 1, free: 3 })
    // Everything paid still leaves the guest a seat
    expect(seatPlan(100, 100, 0, 2)).toEqual({ perPerson: 50, paid: 1, held: 0, free: 1 })
    expect(seatPlan(100, 60, 40, 2)).toEqual({ perPerson: 50, paid: 1, held: 0, free: 1 })
    expect(seatPlan(100, 0, 0, 3).free).toBe(3)
  })

  it('keeps the picked seats that are still free, and one at least', () => {
    expect(pickedSeats(new Set([3, 0, 1]), 3)).toEqual([0, 1])
    expect(pickedSeats(new Set([4]), 3)).toEqual([0])
    expect(pickedSeats(new Set(), 3)).toEqual([0])
  })

  it('agrees with the server on what the picked seats cost', () => {
    const plan = seatPlan(408.2, 81.64, 0, 5)
    expect(equalShare(408.2, 326.56, 2, 5)).toBe(163.28)
    // The last free seats take what is left, rounding and all
    expect(equalShare(408.2, 326.56, plan.free, 5)).toBe(326.56)
  })
})

describe('custom amount slider', () => {
  it('steps by 1 for small bills and 5 past 200', () => {
    expect(sliderStep(150)).toBe(1)
    expect(sliderStep(326.56)).toBe(5)
  })

  it('ends exactly on what is left', () => {
    expect(sliderSteps(326.56)).toBe(66)
    expect(sliderAmount(65, 326.56)).toBe(325)
    expect(sliderAmount(66, 326.56)).toBe(326.56)
    expect(sliderAmount(0, 326.56)).toBe(0)
    expect(sliderSteps(150)).toBe(150)
    expect(sliderAmount(150, 150)).toBe(150)
    expect(sliderSteps(0)).toBe(0)
  })

  it('finds the step nearest an amount', () => {
    expect(sliderPosition(100, 326.56)).toBe(20)
    expect(sliderPosition(326.56, 326.56)).toBe(66)
    expect(sliderPosition(999, 326.56)).toBe(66)
    expect(sliderPosition(0, 326.56)).toBe(0)
  })
})

describe('quickAmounts', () => {
  it('offers fractions, all, and the largest round sums below what is left', () => {
    expect(quickAmounts(326.56).map((q) => q.amount)).toEqual([81.64, 108.85, 163.28, 326.56, 50, 100, 200])
    expect(quickAmounts(40).map((q) => q.amount)).toEqual([10, 13.33, 20, 40])
    expect(quickAmounts(0)).toEqual([])
  })
})
