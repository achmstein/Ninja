// The compact sale pad marks each item with its category's colour down the
// tile's start edge, so a cashier finds the drinks or the grills by colour
// in a long run of text tiles. Nobody picks it: it comes from the category's
// id, so it is the same on every till and after every reload.

/** The golden angle: consecutive ids land far apart on the colour wheel. */
const GOLDEN_ANGLE = 137.508

/**
 * The category's colour as CSS, or null when the item has no category. A
 * mid lightness and a moderate chroma read as a colour on a white card and
 * on a dark one alike.
 */
export function categoryColour(
  categoryId: number | string | null | undefined,
): string | null {
  const id = Number(categoryId)
  if (categoryId === null || categoryId === undefined || !Number.isFinite(id))
    return null
  const hue = (((id * GOLDEN_ANGLE) % 360) + 360) % 360
  return `oklch(0.68 0.15 ${hue.toFixed(1)})`
}
