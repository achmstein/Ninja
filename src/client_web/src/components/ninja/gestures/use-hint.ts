import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import { hintBook, type HintKey } from './hints'

/**
 * The cue on screen, one at a time across the whole app: the menu's swipe,
 * pinch and hold and the tray's pull each wait for the one showing to end,
 * rather than a fingertip and its words landing on top of another's
 */
const useCueOnScreen = create<{ key: HintKey | null }>(() => ({ key: null }))

/**
 * One first-visit cue. `pending` is true until the cue has been shown or the
 * guest has done the gesture themselves; showing it (`show`) records it at
 * once, so a reload mid-cue does not replay it, and `done` hides it. `show`
 * does nothing while another cue is on screen: this one stays pending, and
 * its caller asks again when its moment comes round.
 */
export function useHint(key: HintKey) {
  const [pending, setPending] = useState(() => !hintBook.seen(key))
  const [showing, setShowing] = useState(false)

  const show = useCallback(() => {
    if (!pending) return
    const onScreen = useCueOnScreen.getState().key
    if (onScreen && onScreen !== key) return
    useCueOnScreen.setState({ key })
    hintBook.markSeen(key)
    setShowing(true)
  }, [key, pending])

  const done = useCallback(() => {
    hintBook.markSeen(key)
    setPending(false)
    setShowing(false)
    if (useCueOnScreen.getState().key === key) useCueOnScreen.setState({ key: null })
  }, [key])

  // A page left mid-cue lets the next one show
  useEffect(
    () => () => {
      if (useCueOnScreen.getState().key === key) useCueOnScreen.setState({ key: null })
    },
    [key]
  )

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

/** Whether no cue is on screen now, so another may start */
export function useNoCueOnScreen(): boolean {
  return useCueOnScreen((s) => s.key === null)
}
