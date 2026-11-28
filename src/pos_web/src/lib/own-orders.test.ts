import { describe, expect, it, vi } from 'vitest'
import { beginPlacing, isOwnOrder } from './own-orders'

describe('the orders this till rang up', () => {
  it('knows an order whose sale has answered', async () => {
    beginPlacing()(101)
    expect(await isOwnOrder(101)).toBe(true)
  })

  it("takes an order as someone else's when no sale is on its way", async () => {
    expect(await isOwnOrder(202)).toBe(false)
  })

  it('waits for a sale in flight before deciding, since the news can beat the answer', async () => {
    const answered = beginPlacing()
    const asked = isOwnOrder(303)
    answered(303)
    expect(await asked).toBe(true)
  })

  it("does not claim another till's order that arrives while a sale is in flight", async () => {
    const answered = beginPlacing()
    const asked = isOwnOrder(404)
    answered(405)
    expect(await asked).toBe(false)
  })

  it('stops waiting for a sale that never answers', async () => {
    vi.useFakeTimers()
    const answered = beginPlacing()
    const asked = isOwnOrder(505)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await asked).toBe(false)
    answered()
    vi.useRealTimers()
  })
})
