/**
 * The control panel frames this app to show the owner their brand, and
 * asks for a language and a scheme in the query string. Read once at boot;
 * while a preview is on, nothing chosen here is remembered, so the frame
 * never changes what a real visitor on this browser sees.
 */
import type { BrandThemeInput } from '@/lib/brand-theme'

export type PreviewScheme = 'light' | 'dark'
export type PreviewLanguage = 'en' | 'ar'

export type Preview = {
  active: boolean
  theme?: PreviewScheme
  language?: PreviewLanguage
}

function read(): Preview {
  if (typeof window === 'undefined') return { active: false }
  const params = new URLSearchParams(window.location.search)
  const theme = params.get('preview-theme')
  const lang = params.get('lang')
  const preview: Preview = { active: theme === 'light' || theme === 'dark' }
  if (preview.active) preview.theme = theme as PreviewScheme
  if (preview.active && (lang === 'en' || lang === 'ar')) preview.language = lang
  return preview
}

export const preview: Preview = read()

// The frame is a phone: the stylesheet hides scrollbars under this mark,
// and the mouse is a finger, since a rail with no scrollbar can only be swiped
if (preview.active) {
  document.documentElement.dataset.preview = ''
  mouseAsFinger()
}

/** How far a press may wander before it is a swipe rather than a tap, in px: what touch uses. */
const SWIPE = 6

/**
 * Drag to scroll, for the mouse. On a phone the category rail and the offers
 * carousel are swiped; the frame hides their scrollbars to look like one, and
 * a mouse has nothing left to grab. So a press that moves past the tap
 * threshold scrolls the nearest ancestor that can scroll along the dominant
 * axis (the page itself, for a vertical drag), and the click at the end of a
 * swipe is swallowed, as touch swallows it. Touch and pen already swipe.
 */
function mouseAsFinger() {
  type Axis = 'x' | 'y'
  let start: { x: number; y: number; target: Element } | null = null
  let scroller: { el: Element; axis: Axis } | null = null
  let swiped = false

  const room = (el: Element, axis: Axis) =>
    axis === 'x' ? el.scrollWidth > el.clientWidth : el.scrollHeight > el.clientHeight
  const asked = (el: Element, axis: Axis) => {
    const style = getComputedStyle(el)
    const overflow = axis === 'x' ? style.overflowX : style.overflowY
    return overflow === 'auto' || overflow === 'scroll'
  }
  // The nearest ancestor with more content than room along the axis that
  // scrolls: the page does whatever its overflow says, anything else asks
  const scrollerOf = (from: Element, axis: Axis) => {
    for (let el: Element | null = from; el; el = el.parentElement) {
      if (room(el, axis) && (el === document.documentElement || asked(el, axis))) return el
    }
    return null
  }

  document.addEventListener('pointerdown', (e) => {
    // A swipe that ended off the frame had no click to swallow; the next press starts clean
    swiped = false
    if (e.pointerType !== 'mouse' || e.button !== 0 || !(e.target instanceof Element)) return
    start = { x: e.clientX, y: e.clientY, target: e.target }
    scroller = null
  })
  document.addEventListener('pointermove', (e) => {
    if (!start || e.pointerType !== 'mouse') return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (!scroller) {
      if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return
      const axis: Axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      const el = scrollerOf(start.target, axis)
      if (!el) {
        start = null
        return
      }
      scroller = { el, axis }
      swiped = true
      // A finger selects nothing on the way
      document.documentElement.style.userSelect = 'none'
      window.getSelection()?.removeAllRanges()
    } else if (scroller.axis === 'x') {
      // Content follows the pointer: the delta goes the other way on the scroll
      scroller.el.scrollLeft -= dx
    } else {
      scroller.el.scrollTop -= dy
    }
    start = { ...start, x: e.clientX, y: e.clientY }
  })
  const release = () => {
    if (scroller) document.documentElement.style.userSelect = ''
    start = null
    scroller = null
  }
  document.addEventListener('pointerup', release)
  document.addEventListener('pointercancel', release)
  // The swipe's own click, before anything on the page sees it
  document.addEventListener(
    'click',
    (e) => {
      if (!swiped) return
      swiped = false
      e.stopPropagation()
      e.preventDefault()
    },
    true
  )
}

/**
 * The panel framing this app posts the theme it is drafting, so the real
 * app paints unsaved seeds as they change; nothing is kept. Only a framer
 * can send (the customer site lets its control and admin hosts frame it),
 * and only the theme is taken from what it sends.
 */
const DRAFT_THEME = 'ninja:preview-theme'
const READY = 'ninja:preview-ready'

let drafted: BrandThemeInput | null = null

/** The theme the framing panel is drafting, or null to show the saved brand */
export const draftedTheme = () => drafted

/** Listens for the panel's drafts and tells it the frame is ready for one; returns the stop. */
export function onDraftedTheme(handler: (input: BrandThemeInput | null) => void): () => void {
  if (!preview.active || window.parent === window) return () => {}
  const listen = (e: MessageEvent) => {
    if (e.source !== window.parent) return
    const data = e.data as { type?: string; theme?: BrandThemeInput | null } | null
    if (!data || data.type !== DRAFT_THEME) return
    drafted = data.theme ?? null
    handler(drafted)
  }
  window.addEventListener('message', listen)
  window.parent.postMessage({ type: READY }, '*')
  return () => window.removeEventListener('message', listen)
}
