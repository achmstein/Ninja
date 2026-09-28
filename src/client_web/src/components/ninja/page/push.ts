/**
 * A page pushed from a row keeps the row's name: it travels from the row
 * into the page's large title and back on the menu's spring, one shape
 * rather than a page swapped in (NinjaPage `push`, components/ninja/page/tile-row.tsx
 * `push`). Few ids, on purpose: Motion measures every one of them.
 */
export function pushTitleId(id: string) {
  return `push-title-${id}`
}
