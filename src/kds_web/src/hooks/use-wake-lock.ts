import { useEffect } from 'react'

/**
 * Keeps the screen on while the board is open. A kitchen display is a
 * tablet on a wall that nobody touches for minutes at a time; without this
 * it dims and locks between orders. The lock is lost whenever the tab is
 * hidden, so it is taken again on every return to the foreground. Browsers
 * without the API, or a device on battery saver, simply decline — nothing
 * to recover.
 */
export function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let disposed = false

    const request = async () => {
      if (!('wakeLock' in navigator)) return
      if (document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Denied (battery saver, permissions) — the screen behaves as before
      }
    }

    request()

    const handleVisibility = () => {
      if (!disposed && document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [])
}
