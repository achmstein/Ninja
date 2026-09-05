import { useEffect, useState } from 'react'

/**
 * Browsers refuse to play audio until the page has seen a user gesture, so
 * a freshly booted kitchen screen is silent until somebody taps it once.
 * This reports whether that tap has happened, so the board can ask for it
 * instead of ringing into the void.
 */
export function useSoundUnlock(): boolean {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    if (unlocked) return
    const unlock = () => setUnlocked(true)
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [unlocked])

  return unlocked
}
