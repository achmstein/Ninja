// A sign-in that fails on the way back from Keycloak nearly always works the
// second time: the page was reloaded onto a new release half-way through, or
// the network dropped for a moment as the installed till woke up. The cashier
// used to be shown Sign-in failed and had to press Try again; the till now
// tries again by itself, once, and shows the error only if that fails too.

const RETRIED_KEY = 'ninja-pos-sign-in-retried'
/** One automatic try per failure: a second failure this soon is shown */
const RETRY_GAP_MS = 60_000

/** Whether an automatic try may start now, given when the last one did (null: never). */
export function mayRetrySignIn(lastRetryAt: number | null, now: number): boolean {
  return lastRetryAt == null || now < lastRetryAt || now - lastRetryAt > RETRY_GAP_MS
}

/** Claims the one automatic try. False when it was just used: the error is shown instead. */
export function claimSignInRetry(): boolean {
  try {
    const raw = sessionStorage.getItem(RETRIED_KEY)
    const last = raw == null ? null : Number(raw)
    if (!mayRetrySignIn(Number.isFinite(last) ? last : null, Date.now())) return false
    sessionStorage.setItem(RETRIED_KEY, String(Date.now()))
    return true
  } catch {
    // No storage to remember the try in: trying could go round for ever
    return false
  }
}
