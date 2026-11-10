import { create } from 'zustand'

/**
 * The page's own finger. While nobody has touched a screen the page plays
 * the café by itself, and shows where it taps: a control carries a <Tap>
 * with its name, and the ring shows on the one being tapped.
 */
export const useGhost = create<{ at: string | null; n: number }>(() => ({ at: null, n: 0 }))

export function ghostTap(at: string) {
  useGhost.setState((s) => ({ at, n: s.n + 1 }))
  window.setTimeout(() => useGhost.setState((s) => (s.at === at ? { at: null } : s)), 650)
}

/** The ring of the page's finger, inside the control it taps (which must be `relative`) */
export function Tap({ id }: { id: string }) {
  const on = useGhost((s) => s.at === id)
  const n = useGhost((s) => s.n)
  if (!on) return null
  return (
    <span key={n} aria-hidden className='pointer-events-none absolute inset-0 z-50 grid place-items-center'>
      <span className='tap-dot size-[44px] rounded-full border-2 border-white/95 bg-slate-900/25' />
      <span className='tap-ring absolute size-[44px] rounded-full border-[3px] border-slate-900/35' />
    </span>
  )
}
