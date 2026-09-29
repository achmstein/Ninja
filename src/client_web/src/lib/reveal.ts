/**
 * Something just opened under the thumb (a note, a code, a booking's form):
 * the scrollers it sits in bring it into view, so the customer sees what
 * their tap did rather than having to go and find it.
 */
export function reveal(el: Element | null, reduced: boolean | null = false) {
  el?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
}

/** A field that took the focus: once the phone's keyboard is up, it scrolls into the middle of what is left of the screen */
export function revealField(el: HTMLElement) {
  window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
}
