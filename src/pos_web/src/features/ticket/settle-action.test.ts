import { describe, expect, it } from 'vitest'
import { cashNotes, settleAction } from './settle-action'

describe('settleAction', () => {
  it('takes all that is left in the way picked when nothing is typed', () => {
    expect(settleAction('Cash', null, 180)).toEqual({ kind: 'take', amount: 180 })
    expect(settleAction('Card', null, 180)).toEqual({ kind: 'take', amount: 180 })
  })

  it('never puts an untyped amount on a tab', () => {
    expect(settleAction('Account', null, 180)).toEqual({ kind: 'none' })
    expect(settleAction('Account', 60, 180)).toEqual({ kind: 'add', amount: 60 })
  })

  it('adds a payment when less than what is left is typed', () => {
    expect(settleAction('Cash', 100, 180)).toEqual({ kind: 'add', amount: 100 })
    expect(settleAction('Cash', 0, 180)).toEqual({ kind: 'none' })
  })

  it('takes cash past what is owed, for the change, and anything else exactly', () => {
    expect(settleAction('Cash', 200, 180)).toEqual({ kind: 'take', amount: 200 })
    expect(settleAction('Card', 200, 180)).toEqual({ kind: 'take', amount: 180 })
    expect(settleAction('Account', 200, 180)).toEqual({ kind: 'take', amount: 180 })
  })

  it('closes a bill with nothing left to take', () => {
    expect(settleAction('Cash', null, 0)).toEqual({ kind: 'settle' })
    expect(settleAction('Card', 50, 0)).toEqual({ kind: 'settle' })
  })
})

describe('cashNotes', () => {
  it('offers exactly what is left, then the notes it rounds up to', () => {
    expect(cashNotes(180)).toEqual([180, 200, 500])
    expect(cashNotes(35)).toEqual([35, 50, 100, 200])
    expect(cashNotes(100)).toEqual([100, 200, 500])
    expect(cashNotes(0)).toEqual([])
  })
})
