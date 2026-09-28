/** The first-visit gestures a fingertip acts out (gesture-hint.tsx) */
export type GestureKind = 'swipe' | 'pinch' | 'hold' | 'drag'

/** One pass of each gesture, s: the swipe and the pinch the same as the deck's own demo (components/menu/menu-screen.tsx) */
export const GESTURE_S: Record<GestureKind, number> = { swipe: 1.6, pinch: 2.2, hold: 1.6, drag: 1.4 }

/** The pause between the two passes, s */
export const GESTURE_GAP_S = 0.5

/** When the demo starts, s after the cue shows */
export const GESTURE_DELAY_S = 0.2

/** How long a cue stays up: both passes, the pause and the start, ms */
export function gestureMs(kind: GestureKind): number {
  return Math.round((GESTURE_DELAY_S + GESTURE_S[kind] * 2 + GESTURE_GAP_S) * 1000) + 300
}
