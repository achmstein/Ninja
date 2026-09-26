import { useRouterState } from '@tanstack/react-router'
import { NinjaTopBar } from './ninja/ninja-top-bar'

const tabPaths = ['/places', '/bills', '/profile']

/**
 * The slim see-through bar on a phone's tabs, staying put while the page
 * scrolls under it. The menu draws its own over the deck; pushed pages (cart,
 * item, room…) bring their own back headers.
 */
export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (!tabPaths.includes(pathname)) return null
  return <NinjaTopBar className='sticky top-[env(safe-area-inset-top)]' />
}
