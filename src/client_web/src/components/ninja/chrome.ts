/**
 * The Ninja chrome's measures, shared by the bars and the menu under them.
 * A short screen (a small phone, or a browser whose bars take their share)
 * gets every piece a little smaller rather than losing any: read once, as
 * a phone does not grow taller while the app is open.
 */

/** A screen this short (px of the window's height) draws the chrome compact */
const SHORT_BELOW = 740

export const SHORT = typeof window !== 'undefined' && window.innerHeight < SHORT_BELOW

/** The top bar's height, px: the island (40 px) sits on its middle line */
export const NINJA_BAR_H = SHORT ? 54 : 64

/** Room at the top of the deck and the grid for the top bar over them, px */
export const DECK_TOP = NINJA_BAR_H + 4

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
