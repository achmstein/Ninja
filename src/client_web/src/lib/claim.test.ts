import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkClaimForm, claimProblem, forgetPendingClaim, isLinkProblem, readClaimToken, readPendingClaim, rememberPendingClaim } from './claim'

// A customer the business added at the counter opens the link the cashier
// showed them: what the page makes of the token, and of each refusal.

function refused(status: number, data?: unknown) {
  const headers = new AxiosHeaders()
  return new AxiosError('refused', String(status), { headers }, null, {
    status,
    statusText: '',
    headers: {},
    config: { headers },
    data,
  })
}

describe('claimProblem', () => {
  it('reads the link refusals in a word', () => {
    expect(claimProblem(refused(404, { reason: 'invalid' }))).toBe('invalid')
    expect(claimProblem(refused(410, { reason: 'expired' }))).toBe('expired')
    expect(claimProblem(refused(410, { reason: 'used' }))).toBe('used')
    expect(isLinkProblem('used')).toBe(true)
  })

  it('points a form refusal at its field', () => {
    expect(claimProblem(refused(409, { field: 'email' }))).toBe('emailTaken')
    expect(claimProblem(refused(400, { field: 'password' }))).toBe('weakPassword')
    expect(claimProblem(refused(400, { field: 'email' }))).toBe('badEmail')
    expect(isLinkProblem('emailTaken')).toBe(false)
  })

  it('says too many tries, and anything else failed', () => {
    expect(claimProblem(refused(429))).toBe('tooMany')
    expect(claimProblem(refused(500))).toBe('failed')
    expect(claimProblem(new Error('offline'))).toBe('failed')
  })
})

describe('readClaimToken', () => {
  it('takes a token as the link carries it', () => {
    const token = '7b4e2fee6aa04cd59851c04be2220a00.Ab_c-D09xyz'
    expect(readClaimToken(token)).toBe(token)
    expect(readClaimToken(` ${token}\n`)).toBe(token)
  })

  it('refuses what is plainly not one', () => {
    expect(readClaimToken(undefined)).toBeUndefined()
    expect(readClaimToken(42)).toBeUndefined()
    expect(readClaimToken('no-dot')).toBeUndefined()
    expect(readClaimToken('a.b<script>')).toBeUndefined()
  })
})

describe('checkClaimForm', () => {
  it('wants an email and eight characters of password', () => {
    expect(checkClaimForm('mona@example.com', 'a-good-password')).toBeNull()
    expect(checkClaimForm('mona', 'a-good-password')).toBe('badEmail')
    expect(checkClaimForm('mona@example.com', 'short')).toBe('weakPassword')
  })
})

describe('a claim waiting on Google or Apple', () => {
  const token = '0123456789abcdef0123456789abcdef.c2VjcmV0LXNlY3JldA'
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  beforeEach(() => store.clear())

  it('is there on the way back, and gone once finished', () => {
    rememberPendingClaim(token, 'google', 1_000)
    expect(readPendingClaim(60_000)).toEqual({ token, hint: 'google', at: 1_000 })
    forgetPendingClaim()
    expect(readPendingClaim(60_000)).toBeNull()
  })
  it('is nothing once it is old: a sign-in later that day is not a claim', () => {
    rememberPendingClaim(token, 'apple', 1_000)
    expect(readPendingClaim(1_000 + 11 * 60 * 1000)).toBeNull()
  })
  it('is nothing when the note is not one of ours', () => {
    store.set('ninja-claim-pending', '{"token":"<script>","hint":"google","at":1000}')
    expect(readPendingClaim(2_000)).toBeNull()
    store.set('ninja-claim-pending', 'not json')
    expect(readPendingClaim(2_000)).toBeNull()
  })
  it('reads an account that is already a customer apart from a taken email', () => {
    expect(claimProblem(refused(409, { reason: 'accountExists' }))).toBe('socialTaken')
    expect(isLinkProblem('socialTaken')).toBe(false)
  })
})
