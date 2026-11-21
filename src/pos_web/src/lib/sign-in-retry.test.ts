import { describe, expect, it } from 'vitest'
import { mayRetrySignIn } from './sign-in-retry'

describe('mayRetrySignIn', () => {
  it('tries again the first time a sign-in fails', () => {
    expect(mayRetrySignIn(null, 1_000_000)).toBe(true)
  })

  it('shows the error when the try it just made failed too', () => {
    expect(mayRetrySignIn(1_000_000, 1_020_000)).toBe(false)
  })

  it('tries again for a failure long after the last one', () => {
    expect(mayRetrySignIn(1_000_000, 1_061_000)).toBe(true)
    // A clock set back is not a reason to hold the error up for ever
    expect(mayRetrySignIn(1_000_000, 900_000)).toBe(true)
  })
})
