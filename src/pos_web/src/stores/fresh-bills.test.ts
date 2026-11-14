import { describe, expect, it } from 'vitest'
import { changedBills } from './fresh-bills'

const bill = (id: number, lineCount: number, total = lineCount * 10) => ({ id, lineCount, total })

describe('the bills that just changed', () => {
  it('marks nothing on the first look', () => {
    expect(changedBills(null, [bill(1, 2)]).changed).toEqual([])
  })

  it('marks a bill that was not there', () => {
    const { now } = changedBills(null, [bill(1, 2)])
    expect(changedBills(now, [bill(1, 2), bill(2, 1)]).changed).toEqual([2])
  })

  it('marks a bill something was added to', () => {
    const { now } = changedBills(null, [bill(1, 2)])
    expect(changedBills(now, [bill(1, 3)]).changed).toEqual([1])
  })

  it('leaves a bill alone when a line came off it or only its total moved', () => {
    const { now } = changedBills(null, [bill(1, 2), bill(2, 2, 50)])
    expect(changedBills(now, [bill(1, 1), bill(2, 2, 40)]).changed).toEqual([])
  })
})
