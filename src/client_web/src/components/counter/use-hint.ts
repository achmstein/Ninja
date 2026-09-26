import { useCallback, useEffect, useState } from 'react'
import { hintBook, type HintKey } from './hints'

/**
 * One first-visit cue. `pending` is true until the cue has been shown or the
 * guest has done the gesture themselves; showing it (`show`) records it at
 * once, so a reload mid-cue does not replay it, and `done` hides it.
 */
export function useHint(key: HintKey) {
  const [pending, setPending] = useState(() => !hintBook.seen(key))
  const [showing, setShowing] = useState(false)

  const show = useCallback(() => {
    if (!pending) return
    hintBook.markSeen(key)
    setShowing(true)
  }, [key, pending])

  const done = useCallback(() => {
    hintBook.markSeen(key)
    setPending(false)
    setShowing(false)
  }, [key])

  return { pending, showing, show, done }
}

/** Calls `onTimeout` after `ms` while `active`; nothing runs otherwise. */
export function useTimeout(active: boolean, ms: number, onTimeout: () => void) {
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(onTimeout, ms)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ms])
}
