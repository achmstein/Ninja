import { AxiosError } from 'axios'
import { create } from 'zustand'

/** How often a till that lost the server asks again whether it is back */
export const PROBE_INTERVAL_MS = 15_000

/**
 * A call that never got an answer: no network, the server out of reach, or
 * a timeout. A refusal from the server (any status) is an answer, and so is
 * a call the till cancelled itself.
 */
export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false
  if (error.code === AxiosError.ERR_CANCELED) return false
  return !error.response
}

type NetworkState = {
  /** Whether the server answered the last call. Starts hopeful: the first call says otherwise. */
  online: boolean
  reportSuccess: () => void
  reportFailure: () => void
}

/**
 * Whether the till can reach the server, mirroring the Flutter till's
 * NetworkStatus: every API call reports how it went (lib/api-client.ts), so
 * the first failed call is the first sign, and the first answered one ends
 * it. The browser's own online flag only says there is a network, not that
 * the internet behind it works, so it is a hint, never the word.
 */
export const useNetworkStatus = create<NetworkState>()((set, get) => ({
  online: true,
  reportSuccess: () => {
    if (!get().online) set({ online: true })
  },
  reportFailure: () => {
    if (get().online) set({ online: false })
  },
}))

export const networkStatus = {
  isOnline: () => useNetworkStatus.getState().online,
  reportSuccess: () => useNetworkStatus.getState().reportSuccess(),
  reportFailure: () => useNetworkStatus.getState().reportFailure(),
}

/**
 * Listens to the browser's hints and, while the server is out of reach,
 * asks it again every few seconds with `probe` (any call through the shared
 * client, which reports the answer itself). Returns the stop function.
 */
export function watchNetwork(
  probe: () => Promise<unknown>,
  intervalMs = PROBE_INTERVAL_MS,
): () => void {
  const ask = () => {
    probe().catch(() => {})
  }
  const onOffline = () => networkStatus.reportFailure()
  // The network is back: whether the server is too is the probe's to say
  const onOnline = () => ask()
  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    networkStatus.reportFailure()
  }

  let timer: ReturnType<typeof setInterval> | null = null
  const sync = (online: boolean) => {
    if (online && timer) {
      clearInterval(timer)
      timer = null
    } else if (!online && !timer) {
      timer = setInterval(ask, intervalMs)
    }
  }
  sync(networkStatus.isOnline())
  const unsubscribe = useNetworkStatus.subscribe((s) => sync(s.online))

  return () => {
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
    unsubscribe()
    if (timer) clearInterval(timer)
  }
}
