import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { checkClaimForm, claimProblem, isLinkProblem, readClaimToken } from './claim'

// A customer the café added at the counter opens the link the cashier
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
