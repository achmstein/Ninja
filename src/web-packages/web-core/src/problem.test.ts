import { describe, expect, it } from 'vitest'
import { isModuleOff, problemCode, problemReason, problemStatus } from './problem'

const answered = (status: number, data: unknown) => ({ response: { status, data } })

describe('problem', () => {
  it('reads the code from code, else a dotted type', () => {
    expect(problemCode(answered(409, { code: 'delivery.conflict' }))).toBe('delivery.conflict')
    expect(problemCode(answered(409, { type: 'order.paused' }))).toBe('order.paused')
    expect(problemCode(answered(409, { type: 'https://tools.ietf.org/html/rfc9110' }))).toBeNull()
    expect(problemCode(new Error('no answer'))).toBeNull()
  })

  it("reads the status, a module switched off, and the server's own words", () => {
    expect(problemStatus(answered(402, {}))).toBe(402)
    expect(isModuleOff(answered(402, {}))).toBe(true)
    expect(isModuleOff(answered(400, { code: 'module.off' }))).toBe(true)
    expect(problemReason(answered(400, { detail: 'D', title: 'T' }))).toBe('D')
    expect(problemReason(answered(400, { title: 'T' }))).toBe('T')
    expect(problemReason(answered(400, 'text'))).toBeUndefined()
  })
})
