import { cartCount, cartTotal, lineKey, type CartLine } from '@/lib/cart'

/** What the docked tray shows: the latest lines' photos, how many more there are, and the running count and total. */
export type TraySummary = {
  thumbs: Array<{ key: string; pictureUrl?: string; name: string; quantity: number }>
  /** Lines not shown as a thumbnail */
  more: number
  count: number
  total: number
}

/** Two photos fit beside the total and the hold button on the narrowest phone; the rest are a count */
export const TRAY_THUMBS = 2

export function traySummary(lines: CartLine[], max = TRAY_THUMBS): TraySummary {
  // The newest first, so the dish that just flew in sits at the front
  const newest = [...lines].reverse()
  return {
    thumbs: newest.slice(0, max).map((l) => ({ key: lineKey(l), pictureUrl: l.pictureUrl, name: l.nameEn, quantity: l.quantity })),
    more: Math.max(0, newest.length - max),
    count: cartCount(lines),
    total: cartTotal(lines),
  }
}

/** A line swiped sideways this far (a share of its width), or flicked fast enough, is removed; otherwise it springs back. */
export const SWIPE_REMOVE_SHARE = 0.4
export const SWIPE_REMOVE_VELOCITY = 600

export function swipeRemoves(offset: number, width: number, velocity: number): boolean {
  if (width <= 0) return false
  return Math.abs(offset) >= width * SWIPE_REMOVE_SHARE || Math.abs(velocity) >= SWIPE_REMOVE_VELOCITY
}

/** The tray opens when dragged up far enough or flicked up, and closes the same way down. */
export const TRAY_DRAG_DISTANCE = 60
export const TRAY_DRAG_VELOCITY = 400

export function trayOpensAfterDrag(expanded: boolean, offsetY: number, velocityY: number): boolean {
  if (!expanded) return offsetY <= -TRAY_DRAG_DISTANCE || velocityY <= -TRAY_DRAG_VELOCITY
  return !(offsetY >= TRAY_DRAG_DISTANCE || velocityY >= TRAY_DRAG_VELOCITY)
}

/**
 * The flight of a photo into the tray: where it starts and lands, as a
 * translate and a scale from the start box, so only transform moves.
 */
export type Box = { x: number; y: number; width: number; height: number }

export function flightPath(from: Box, to: Box): { dx: number; dy: number; scale: number } {
  const scale = from.width > 0 ? to.width / from.width : 1
  return {
    dx: to.x + to.width / 2 - (from.x + from.width / 2),
    dy: to.y + to.height / 2 - (from.y + from.height / 2),
    scale,
  }
}

export { DOCK_H } from './chrome'
