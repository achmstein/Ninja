/**
 * Hold to order: the order goes when the button has been held down for the
 * whole of HOLD_MS; letting go early cancels. A small reducer so the timing
 * can be tested without a clock; the hook drives it with one timeout, so
 * nothing ticks while nobody is pressing.
 */
export const HOLD_MS = 700

export type HoldState =
  | { phase: 'idle' }
  | { phase: 'holding'; startedAt: number }
  | { phase: 'committed' }

export type HoldEvent =
  | { type: 'press'; at: number }
  | { type: 'release'; at: number }
  | { type: 'elapse'; at: number }
  | { type: 'reset' }

export function holdReducer(state: HoldState, event: HoldEvent, duration = HOLD_MS): HoldState {
  switch (event.type) {
    case 'press':
      return state.phase === 'idle' ? { phase: 'holding', startedAt: event.at } : state
    case 'release':
    case 'elapse':
      if (state.phase !== 'holding') return state
      // A release that lands on or after the mark still counts: the timer may simply have run late
      if (event.at - state.startedAt >= duration) return { phase: 'committed' }
      return event.type === 'release' ? { phase: 'idle' } : state
    case 'reset':
      return { phase: 'idle' }
  }
}

/** How full the ring is, 0 to 1. */
export function holdProgress(state: HoldState, now: number, duration = HOLD_MS): number {
  if (state.phase === 'committed') return 1
  if (state.phase === 'idle') return 0
  return Math.min(1, Math.max(0, (now - state.startedAt) / duration))
}
