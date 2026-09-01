import { useEffect, useRef, type RefObject } from 'react'

interface DragToDismissOptions {
  /**
   * Close the sheet. The dragged offset is left on the element so the exit
   * animation (slide-out-to-bottom) continues from where the finger let go.
   */
  onDismiss: () => void
  /** Gate the gesture per touch (e.g. only below the md breakpoint). */
  enabled?: () => boolean
}

/**
 * Native-app drag-to-dismiss for bottom sheets: touch-drag the sheet down to
 * close it, with a flick shortcut and a spring-back below the threshold.
 *
 * Uses native (non-passive) touch listeners because React's synthetic
 * touchmove is passive and cannot preventDefault. A gesture that starts
 * inside a scrolled-down scrollable area (options list, textarea) is left to
 * native scrolling; from the top of the sheet, or when the scroller is at
 * scrollTop 0, a downward move grabs the sheet instead.
 *
 * While dragging, the element gets a `data-dragging` attribute (hook for
 * styling, e.g. rounding the top corners of a full-height sheet).
 */
export function useDragToDismiss<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  options: DragToDismissOptions
) {
  // Latest-ref pattern: callbacks stay fresh without resubscribing listeners
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    let startY = 0
    let lastY = 0
    let lastTime = 0
    let velocity = 0 // px/ms, positive = downward
    let offset = 0
    let mode: 'idle' | 'drag' | 'scroll' = 'idle'
    let scroller: HTMLElement | null = null

    const findScroller = (from: Element | null): HTMLElement | null => {
      let node = from as HTMLElement | null
      while (node && node !== el) {
        if (node.scrollHeight > node.clientHeight) {
          const overflowY = getComputedStyle(node).overflowY
          if (overflowY === 'auto' || overflowY === 'scroll') return node
        }
        node = node.parentElement
      }
      return null
    }

    const settleBack = () => {
      el.style.transition = 'transform 200ms ease-out'
      el.style.transform = ''
      const clearTransition = () => {
        el.style.transition = ''
        el.removeEventListener('transitionend', clearTransition)
      }
      el.addEventListener('transitionend', clearTransition)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      if (optionsRef.current.enabled && !optionsRef.current.enabled()) return
      mode = 'idle'
      offset = 0
      startY = lastY = e.touches[0].clientY
      lastTime = e.timeStamp
      velocity = 0
      scroller = findScroller(e.target as Element)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || mode === 'scroll') return
      const y = e.touches[0].clientY
      const dy = y - startY
      if (mode === 'idle') {
        // Small slop before committing the gesture either way
        if (Math.abs(dy) < 8) return
        if (dy < 0 || (scroller && scroller.scrollTop > 0)) {
          mode = 'scroll'
          return
        }
        mode = 'drag'
        el.setAttribute('data-dragging', '')
      }
      e.preventDefault()
      offset = Math.max(0, dy)
      const dt = e.timeStamp - lastTime
      if (dt > 0) velocity = (y - lastY) / dt
      lastY = y
      lastTime = e.timeStamp
      el.style.transition = 'none'
      el.style.transform = `translateY(${offset}px)`
    }

    const onTouchEnd = () => {
      if (mode !== 'drag') return
      mode = 'idle'
      el.removeAttribute('data-dragging')
      const pastThreshold = offset > el.clientHeight * 0.3
      const flicked = velocity > 0.5 && offset > 24
      if (pastThreshold || flicked) {
        el.style.transition = ''
        optionsRef.current.onDismiss()
      } else {
        settleBack()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [active, ref])
}
