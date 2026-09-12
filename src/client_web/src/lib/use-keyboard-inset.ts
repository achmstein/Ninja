import { useEffect, useState } from 'react'

/**
 * How much of the bottom of the layout viewport the on-screen keyboard is
 * covering, in px. Zero when it is closed.
 *
 * On iOS Safari the keyboard does not resize the layout viewport, so anything
 * fixed to `bottom: 0` stays anchored behind it; only `window.visualViewport`
 * knows where the visible bottom edge actually is. Android Chrome resizes the
 * layout viewport instead, so this reads 0 there and nothing changes.
 */
export function useKeyboardInset(enabled = true) {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) {
      setInset(0)
      return
    }

    const update = () => {
      const covered = window.innerHeight - (vv.height + vv.offsetTop)
      // Small differences are browser chrome (address bar), not a keyboard
      setInset(covered > 80 ? Math.round(covered) : 0)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return inset
}
