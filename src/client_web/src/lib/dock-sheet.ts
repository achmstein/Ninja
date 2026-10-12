import { motionValue, type MotionValue } from 'motion/react'
import { create } from 'zustand'

/**
 * Whether the dock's sheet is open: the bill, the table or the room, out of
 * the dock's row. The row opens it, and so can anything else that stands
 * for the same place (the Book tab's "you're in" card), so there is one
 * sheet for it, not a second one. Opened from the row it rises out of the
 * row as the tray's order does (`fromRow`); from anywhere else it grows out
 * of the dock as every sheet does.
 */
export const useDockSheet = create<{
  open: boolean
  fromRow: boolean
  setOpen: (open: boolean) => void
  openFromRow: () => void
}>((set) => ({
  open: false,
  fromRow: false,
  // Opened from elsewhere it is not the row's; closed, it goes back the way it came
  setOpen: (open) => set(open ? { open, fromRow: false } : { open }),
  openFromRow: () => set({ open: true, fromRow: true }),
}))

/**
 * A finger on the dock's row, pulling the sheet up out of it: how far it has
 * gone (px, up is negative), where it stands (under the finger, let go open,
 * or let go shut), and how fast it was going when it let go (px/s, up is
 * negative). The sheet follows it from the first pixel and, let go, springs
 * open or back down into the row by the tray's own rule. A tap is no pull:
 * the sheet springs open.
 */
export type RowPhase = 'pulling' | 'open' | 'shut'

export type RowPull = {
  offset: MotionValue<number>
  phase: MotionValue<RowPhase>
  velocity: MotionValue<number>
}

export const rowPull: RowPull = {
  offset: motionValue(0),
  phase: motionValue<RowPhase>('open'),
  velocity: motionValue(0),
}

/** How far below open a sheet of [height] stands under a finger that has pulled [offset] up from the row, px */
export function pulledLift(height: number, offset: number): number {
  return Math.max(0, Math.min(height, height + offset))
}

/**
 * The page's dimming with the dock left out of it, as the tray's leaves the
 * dock clear: the whole screen ([width] × [height]) less the dock's box with
 * its corners, as a clip path cut by the even-odd rule
 */
export function dockHole(width: number, height: number, dock: { left: number; top: number; right: number; bottom: number }, top: number, bottom: number): string {
  const { left: l, top: t, right: r, bottom: b } = dock
  const tr = Math.min(top, (r - l) / 2, (b - t) / 2)
  const br = Math.min(bottom, (r - l) / 2, (b - t) / 2)
  const hole =
    `M${l + tr} ${t}H${r - tr}A${tr} ${tr} 0 0 1 ${r} ${t + tr}V${b - br}A${br} ${br} 0 0 1 ${r - br} ${b}` +
    `H${l + br}A${br} ${br} 0 0 1 ${l} ${b - br}V${t + tr}A${tr} ${tr} 0 0 1 ${l + tr} ${t}Z`
  return `path(evenodd, 'M0 0H${width}V${height}H0Z${hole}')`
}
