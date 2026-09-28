import { useRouterState } from '@tanstack/react-router'
import { NinjaNavDock } from './nav'

/**
 * The app's tabs on a phone: the Ninja dock, floating off the edges. The menu
 * draws its own, under the tray; paying is a page of its own.
 */
export function BottomNav() {
  // The resolved (committed) location, not the pending one: on a slow
  // navigation the pending one flips before the next page paints, and the
  // dock would vanish while the old page is still on screen
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  })
  if (pathname === '/' || pathname.startsWith('/pay/')) return null
  return <NinjaNavDock />
}
