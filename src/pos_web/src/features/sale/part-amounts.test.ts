import { describe, expect, it } from 'vitest'
import { partAmountProblem } from './part-amounts'

describe('partAmountProblem', () => {
  it('takes their items, or more, while it is less than the bill has left', () => {
    expect(partAmountProblem(70, 70, 190, false)).toBe('none')
    expect(partAmountProblem(100, 70, 190, false)).toBe('none')
  })

  it('never takes less than what they had, nor nothing', () => {
    expect(partAmountProblem(50, 70, 190, false)).toBe('belowItems')
    expect(partAmountProblem(0, 0, 190, true)).toBe('empty')
  })

  it("leaves paying all that is left to the bill's own payment", () => {
    expect(partAmountProblem(190, 70, 190, false)).toBe('paysAll')
    expect(partAmountProblem(200, 70, 190, false)).toBe('paysAll')
  })

  it("takes any amount under a running clock: the room's time is still to come", () => {
    expect(partAmountProblem(200, 70, 190, true)).toBe('none')
    expect(partAmountProblem(50, 0, 0, true)).toBe('none')
  })
})
