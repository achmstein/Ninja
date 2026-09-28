import { describe, expect, it } from 'vitest'
import { HOLD_MS, holdProgress, holdReducer, type HoldState } from './hold'

const idle: HoldState = { phase: 'idle' }

describe('hold to order', () => {
  it('sends when the press lasts the whole hold', () => {
    const holding = holdReducer(idle, { type: 'press', at: 1000 })
    expect(holding).toEqual({ phase: 'holding', startedAt: 1000 })
    expect(holdReducer(holding, { type: 'elapse', at: 1000 + HOLD_MS })).toEqual({ phase: 'committed' })
  })

  it('cancels when let go early', () => {
    const holding = holdReducer(idle, { type: 'press', at: 0 })
    expect(holdReducer(holding, { type: 'release', at: HOLD_MS - 1 })).toEqual(idle)
  })

  it('counts a release on the mark: the timer only ran late', () => {
    const holding = holdReducer(idle, { type: 'press', at: 0 })
    expect(holdReducer(holding, { type: 'release', at: HOLD_MS + 5 })).toEqual({ phase: 'committed' })
  })

  it('ignores a timer that fires early, and a second press while holding', () => {
    const holding = holdReducer(idle, { type: 'press', at: 0 })
    expect(holdReducer(holding, { type: 'elapse', at: HOLD_MS - 50 })).toBe(holding)
    expect(holdReducer(holding, { type: 'press', at: 300 })).toBe(holding)
  })

  it('sends once: nothing but a reset leaves committed', () => {
    const committed: HoldState = { phase: 'committed' }
    expect(holdReducer(committed, { type: 'release', at: 9999 })).toBe(committed)
    expect(holdReducer(committed, { type: 'press', at: 9999 })).toBe(committed)
    expect(holdReducer(committed, { type: 'reset' })).toEqual(idle)
  })

  it('fills the ring in proportion to the time held', () => {
    const holding: HoldState = { phase: 'holding', startedAt: 100 }
    expect(holdProgress(idle, 500)).toBe(0)
    expect(holdProgress(holding, 100 + HOLD_MS / 2)).toBeCloseTo(0.5)
    expect(holdProgress(holding, 100 + HOLD_MS * 3)).toBe(1)
    expect(holdProgress({ phase: 'committed' }, 0)).toBe(1)
  })
})
