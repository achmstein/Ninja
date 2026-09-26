/**
 * A page pushed from a tile keeps the tile's icon and name: they travel from
 * the row (or the card) into the page's title and back on the menu's
 * spring, one shape rather than a page swapped in (NinjaPage `push`,
 * components/tile-row.tsx `push`). Few ids, on purpose: Motion measures
 * every one of them.
 */
export function pushIds(id: string) {
  return { icon: `push-icon-${id}`, title: `push-title-${id}` }
}
