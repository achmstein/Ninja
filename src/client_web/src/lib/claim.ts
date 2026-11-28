import { isAxiosError } from 'axios'

/**
 * Why a claim link or a claim was refused, in the words the page shows.
 * The API says it in a word on 404/410 ({ reason }), names the field it
 * refused on 400/409 ({ field }), and slows guessing with 429.
 */
export type ClaimProblem =
  'invalid' | 'expired' | 'used' | 'emailTaken' | 'socialTaken' | 'badEmail' | 'weakPassword' | 'tooMany' | 'failed'

export const MIN_CLAIM_PASSWORD = 8

type ErrorBody = { reason?: string; field?: string } | undefined

/** The problem behind a failed preview or claim call. */
export function claimProblem(error: unknown): ClaimProblem {
  if (!isAxiosError(error) || !error.response) return 'failed'
  const { status } = error.response
  const body = error.response.data as ErrorBody
  if (status === 429) return 'tooMany'
  if (status === 404) return 'invalid'
  if (status === 410) return body?.reason === 'used' ? 'used' : 'expired'
  if (status === 409) return body?.reason === 'accountExists' ? 'socialTaken' : 'emailTaken'
  if (status === 400) return body?.field === 'password' ? 'weakPassword' : 'badEmail'
  return 'failed'
}

/** Problems that end the page: the link itself is no good. */
export function isLinkProblem(problem: ClaimProblem): boolean {
  return problem === 'invalid' || problem === 'expired' || problem === 'used'
}

/**
 * The token from the link's ?token=, as a scanner or a chat app hands it
 * over: trimmed, and nothing when it is plainly not one of ours
 * ("{userId}.{secret}", URL-safe characters only).
 */
export function readClaimToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const token = value.trim()
  return /^[A-Za-z0-9-]+\.[A-Za-z0-9_-]+$/.test(token) && token.length <= 200 ? token : undefined
}

/** What the form checks before asking the server. */
export function checkClaimForm(email: string, password: string): ClaimProblem | null {
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'badEmail'
  if (password.length < MIN_CLAIM_PASSWORD) return 'weakPassword'
  return null
}

// A claim waiting on Google or Apple: the customer left for the provider's
// page and comes back signed in, and the claim finishes then
const PENDING_KEY = 'ninja-claim-pending'
const PENDING_FOR_MS = 10 * 60 * 1000

export type PendingClaim = { token: string; hint: string; at: number }

/** Note the claim before leaving for the provider (`hint`: the realm's name for it). */
export function rememberPendingClaim(token: string, hint: string, now = Date.now()): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ token, hint, at: now } satisfies PendingClaim))
  } catch {
    // No storage (a private window): the sign-in still happens, the claim is not finished
  }
}

/** The claim that was waiting, if it is recent; an old or broken note is nothing. */
export function readPendingClaim(now = Date.now()): PendingClaim | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as Partial<PendingClaim>
    if (typeof pending.at !== 'number' || now - pending.at > PENDING_FOR_MS || now < pending.at) return null
    const token = readClaimToken(pending.token)
    return token && typeof pending.hint === 'string' && pending.hint
      ? { token, hint: pending.hint, at: pending.at }
      : null
  } catch {
    return null
  }
}

export function forgetPendingClaim(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // nothing to forget
  }
}
