import { isAxiosError } from 'axios'
import { create } from 'zustand'
import { translate } from '@/lib/i18n'

// Once the server says the assistant is not configured (503) the buttons
// go away for the rest of the session; nothing else on the server is going
// to change that. Not persisted: a redeploy with a key should bring it back.
type AssistState = {
  unavailable: boolean
  markUnavailable: () => void
}

export const useAssistStore = create<AssistState>()((set) => ({
  unavailable: false,
  markUnavailable: () => set({ unavailable: true }),
}))

/**
 * What to tell the user when an assist call fails: 429 is "busy", 503 is
 * "not set up" (and hides the feature), a 400 carries the server's own
 * reason, anything else is a generic retry.
 */
export function assistErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status === 429) return translate('assistBusy')
    if (status === 503) {
      useAssistStore.getState().markUnavailable()
      return translate('assistUnavailable')
    }
    if (status === 400) {
      const data = error.response?.data as
        | { detail?: string }
        | string
        | undefined
      const detail = typeof data === 'string' ? data : data?.detail
      if (detail) return detail
    }
  }
  return translate('assistFailed')
}
