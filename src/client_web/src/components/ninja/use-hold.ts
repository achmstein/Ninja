import { useCallback, useEffect, useReducer, useRef } from 'react'
import { HOLD_MS, holdReducer, type HoldEvent, type HoldState } from './hold'

const reducer = (state: HoldState, event: HoldEvent) => holdReducer(state, event)

/**
 * Press and hold: one timeout per press, no frame loop. The ring is a CSS
 * transition started by the phase, so a release simply reverses it. When
 * the commit answers false (a gate stopped the order), the hold starts over.
 */
export function useHold(onCommit: () => void | Promise<boolean>, disabled = false) {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' } as HoldState)
  const timer = useRef<number | null>(null)
  const committed = useRef(onCommit)
  useEffect(() => {
    committed.current = onCommit
  })

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const press = useCallback(() => {
    if (disabled) return
    dispatch({ type: 'press', at: performance.now() })
    clear()
    timer.current = window.setTimeout(() => dispatch({ type: 'elapse', at: performance.now() }), HOLD_MS)
  }, [disabled])

  const release = useCallback(() => {
    clear()
    dispatch({ type: 'release', at: performance.now() })
  }, [])

  const reset = useCallback(() => {
    clear()
    dispatch({ type: 'reset' })
  }, [])

  useEffect(() => {
    if (state.phase !== 'committed') return
    navigator.vibrate?.(12)
    void Promise.resolve(committed.current()).then((sent) => {
      if (sent === false) dispatch({ type: 'reset' })
    })
  }, [state.phase])

  useEffect(() => clear, [])

  return { phase: state.phase, press, release, reset }
}
