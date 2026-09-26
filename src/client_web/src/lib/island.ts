import { sileo, type SileoOptions, type SileoState } from 'sileo'
import { create } from 'zustand'

/**
 * The island: one sileo pill in the middle of the top bar (routes/__root.tsx
 * places the toaster there). Sileo keeps one toast per id and, shown again
 * under the same id, morphs it in place into the new title, colour and
 * icon, so everything the app says goes through this one id:
 * - the live face: what the customer is waiting on (their order), sticky,
 *   changing in place as it moves on;
 * - a flash: something to say now (a failure, an Undo, news from the café),
 *   which morphs the island for a moment and then morphs back to the live
 *   face, or away when there is none.
 * While it is on screen the bar's brand folds and its chips step aside
 * (`useIsland`).
 */
const ISLAND = 'island'

export type IslandFace = Omit<SileoOptions, 'type' | 'duration'> & { type?: SileoState }

export const useIsland = create<{ busy: boolean }>(() => ({ busy: false }))

let live: IslandFace | null = null
let flashing: number | null = null

function put(face: IslandFace) {
  // Sileo reads an id it does not declare: the same id updates the toast in place
  sileo.show({ ...face, duration: null, id: ISLAND } as SileoOptions)
}

/** Back to the live face, or away */
function settle() {
  if (live) put(live)
  else sileo.dismiss(ISLAND)
  useIsland.setState({ busy: live != null })
}

export const island = {
  /** What the customer is waiting on, or null when there is nothing */
  live(face: IslandFace | null) {
    live = face
    if (flashing == null) settle()
  },
  /** Something to say now, for `ms`; the island then goes back to the live face */
  flash(face: IslandFace, ms: number): string {
    if (flashing != null) window.clearTimeout(flashing)
    put(face)
    useIsland.setState({ busy: true })
    flashing = window.setTimeout(() => {
      flashing = null
      settle()
    }, ms)
    return ISLAND
  },
  /** Ends a flash early */
  end() {
    if (flashing == null) return
    window.clearTimeout(flashing)
    flashing = null
    settle()
  },
}
