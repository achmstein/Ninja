import { useCallback, useEffect, useState } from 'react'

/**
 * Browser full screen for a kitchen screen that is not installed as an app:
 * the whole panel is the board, no address bar. Installed (standalone) the
 * button is redundant but harmless.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && document.fullscreenElement != null
  )

  useEffect(() => {
    const handleChange = () =>
      setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Refused outside a user gesture, or unsupported (iOS Safari) — the
      // page simply stays as it is
    }
  }, [])

  const supported =
    typeof document !== 'undefined' &&
    typeof document.documentElement.requestFullscreen === 'function'

  return { isFullscreen, toggle, supported }
}
