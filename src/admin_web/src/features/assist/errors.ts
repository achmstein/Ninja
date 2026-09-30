import { isAxiosError } from 'axios'
import { create } from 'zustand'
import { translate } from '@/lib/i18n'

/** What the server says, word for word, when it has no chat model (Ninja.AI's AIProblems.NotConfiguredDetail) */
export const NOT_CONFIGURED_DETAIL =
  'AI assistant is not configured on this server.'

// Once the server says the assistant is not configured the buttons go away
// for the rest of the session; nothing else on the server is going to
// change that. Only that answer: a 503 from the gateway while a service
// restarts is not it. Not persisted: a redeploy with a key brings it back.
type AssistState = {
  unavailable: boolean
  markUnavailable: () => void
}

export const useAssistStore = create<AssistState>()((set) => ({
  unavailable: false,
  markUnavailable: () => set({ unavailable: true }),
}))

type Problem = { title?: string; detail?: string }

function problemOf(data: unknown): Problem {
  if (typeof data === 'string') return { detail: data }
  if (data && typeof data === 'object') return data as Problem
  return {}
}

/**
 * How long the server asks to wait before the next call (Retry-After, in
 * seconds), when the error is a 429 that says so; null otherwise.
 */
export function assistRetryAfter(error: unknown): number | null {
  if (!isAxiosError(error) || error.response?.status !== 429) return null
  const header = error.response.headers?.['retry-after']
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * What to tell the user when an assist call fails: 429 is "busy", the
 * not-configured 503 is "not set up" (and hides the feature), a timeout, a
 * too-long answer and a rejected key each say so, a 400 carries the
 * server's own reason, anything else is a generic retry.
 */
export function assistErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const problem = problemOf(error.response?.data)
    if (status === 429) return translate('assistBusy')
    if (status === 503 && problem.detail === NOT_CONFIGURED_DETAIL) {
      useAssistStore.getState().markUnavailable()
      return translate('assistUnavailable')
    }
    if (status === 504) return translate('assistTimedOut')
    if (status === 502 && problem.title === 'AI answer too long')
      return translate('assistTooLong')
    if (status === 502 && problem.detail?.includes('API key'))
      return translate('assistKeyRejected')
    if (status === 400 && problem.detail) return problem.detail
  }
  return translate('assistFailed')
}
