/**
 * The Ninja chrome's measures, shared by the bars and the menu under them.
 * A short screen (a small phone, or a browser whose bars take their share)
 * gets every piece a little smaller rather than losing any: read once, as
 * a phone does not grow taller while the app is open.
 */

/** A screen this short (px of the window's height) draws the chrome compact */
const SHORT_BELOW = 740

export const SHORT = typeof window !== 'undefined' && window.innerHeight < SHORT_BELOW

/**
 * The top bar's height is the café's (--bar-h in styles/theme.css: its header
 * size, never shorter than the island in it needs), so it is CSS, not a
 * number here. Room at the top of the menu for the bar over it: the bar,
 * then the gap every page has under it (--page-top)
 */
export const DECK_TOP = 'calc(var(--bar-h) + var(--page-top))'

/** Room at the top of the deck past its first card, the top bar gone up, px */
export const DECK_COMPACT_TOP = 8

/** The tray's row of the bottom dock, px; the order sheet tucks under its top */
export const DOCK_H = SHORT ? 58 : 68

/** The app's tabs, the dock's bottom row, px, and the pill lifting the active one */
export const TABS_H = SHORT ? 48 : 56
export const TAB_PILL_H = SHORT ? 38 : 44

/** The dock's gap to the screen's edges, px */
export const DOCK_INSET = 8

/** The dock's side margin: its gap to the bottom edge too, so it floats evenly off the screen's edges and a small phone's tray keeps the width */
export const DOCK_SIDE = DOCK_INSET

/**
 * Where a sheet or panel over the dock sits, sideways: the dock's own edges
 * (the app's 32rem column, less the dock's margins), so what opens from it
 * is exactly as wide as the tray at every width
 */
export const DOCK_EDGES = { left: DOCK_SIDE, right: DOCK_SIDE, maxWidth: `calc(32rem - ${DOCK_SIDE * 2}px)` } as const
