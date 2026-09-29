import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A handler that keeps one identity for the component's life and always
 * runs the latest `fn`. Handed to a memoised child, it lets the child skip
 * the parent's renders: on the menu every render of a dish with a shared
 * layout re-measures the page's shared layouts, so a new arrow per render
 * was a dropped frame per dish. Call it from events and effects, not while
 * rendering.
 */
export function useHandler<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
