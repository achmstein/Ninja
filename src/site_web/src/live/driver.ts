/**
 * The page's hand on a real app. A script is a list of steps played in order
 * and then again from the top; each step finds one of the app's own controls
 * and uses it as a person would, so what moves on screen is the app's own
 * motion. A step that cannot find its control is skipped: the app may have
 * changed, and the demo should carry on rather than stop.
 */
export type Step =
  | { do: 'wait'; ms: number }
  /** Tap the first control whose accessible name or text matches */
  | { do: 'tap'; find: string | RegExp; in?: string; nth?: number }
  /** Scroll the page (or the first element matching `in`) to a fraction of its length */
  | { do: 'scroll'; to: number; in?: string }
  /** Go back, as the phone's back gesture does */
  | { do: 'back' }
  /** Load the app afresh, so the next round starts clean */
  | { do: 'reload' }

export type Script = Step[]

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function named(el: Element): string {
  return (el.getAttribute('aria-label') ?? '') + ' ' + (el.textContent ?? '')
}

function findControl(doc: Document, find: string | RegExp, scope?: string, nth = 0): HTMLElement | null {
  const root = scope ? doc.querySelector(scope) : doc
  if (!root) return null
  const hits = [...root.querySelectorAll<HTMLElement>('button, a, [role=button], [role=tab], [role=radio], [role=checkbox], label')].filter((el) => {
    if (!el.getClientRects().length) return false
    const name = named(el).trim()
    return typeof find === 'string' ? name.toLowerCase().includes(find.toLowerCase()) : find.test(name)
  })
  return hits[nth] ?? null
}

/** A finger's mark where the tap lands, drawn inside the app so it scales with it */
function mark(doc: Document, x: number, y: number) {
  const dot = doc.createElement('div')
  dot.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;background:rgb(15 23 42 / .22);border:2px solid rgb(255 255 255 / .95);z-index:2147483647;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out;`
  doc.body.appendChild(dot)
  requestAnimationFrame(() => {
    dot.style.transform = 'scale(1.5)'
    dot.style.opacity = '0'
  })
  window.setTimeout(() => dot.remove(), 520)
}

/** Plays `script` in the app inside `frame`, over and over; returns the stop */
export function runScript(frame: HTMLIFrameElement, script: Script): () => void {
  let stopped = false
  ;(async () => {
    while (!stopped) {
      for (const step of script) {
        if (stopped) return
        const win = frame.contentWindow
        const doc = frame.contentDocument
        if (!win || !doc?.body) {
          await wait(500)
          continue
        }
        if (step.do === 'wait') {
          await wait(step.ms)
        } else if (step.do === 'tap') {
          const el = findControl(doc, step.find, step.in, step.nth)
          if (!el) continue
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          await wait(250)
          const r = el.getBoundingClientRect()
          mark(doc, r.left + r.width / 2, r.top + r.height / 2)
          await wait(160)
          if (!stopped) el.click()
        } else if (step.do === 'scroll') {
          const target = step.in ? doc.querySelector(step.in) : doc.scrollingElement
          target?.scrollTo({ top: (target.scrollHeight - target.clientHeight) * step.to, behavior: 'smooth' })
        } else if (step.do === 'back') {
          win.history.back()
        } else if (step.do === 'reload') {
          // What the last round left behind (a tray, a table) goes; the language it was shown in stays
          for (const key of Object.keys(win.localStorage)) if (!key.endsWith('-language')) win.localStorage.removeItem(key)
          win.sessionStorage.clear()
          win.location.reload()
          await wait(2500)
        }
      }
    }
  })()
  return () => {
    stopped = true
  }
}
