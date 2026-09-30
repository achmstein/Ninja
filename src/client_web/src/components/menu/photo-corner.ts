/**
 * The corner a photo is seen with: its own, or that of the card clipping it
 * (a deck card rounds its photo; an open card's photo is square), so a
 * flight starts with exactly the corners that were on screen
 */
export function cornerOf(el: HTMLElement | null): number {
  for (let node = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
    const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius)
    if (radius > 0) return radius
  }
  return 0
}
