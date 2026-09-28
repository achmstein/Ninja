import { Coffee, Gamepad2, User } from 'lucide-react'

// Three tabs: Menu / Places / You. The places tab is where the customer is
// in the cafe, so its label and icon follow the visit (docs/visit-tab.html).
// The bill running now lives on the menu's dock; all of them are under You
// (Your bills). The dock draws these. `under` lists the pages pushed from a
// tab, which keep that tab lit.
export const NAV_TABS = [
  { to: '/', key: 'menu', icon: Coffee, exact: true, under: ['/item/'] },
  { to: '/places', key: 'rooms', icon: Gamepad2, under: ['/p/', '/stays'] },
  { to: '/profile', key: 'youTab', icon: User, under: ['/bills', '/receipts/', '/pay/', '/settings', '/loyalty', '/account', '/claim'] },
] as const

export type NavTab = (typeof NAV_TABS)[number]

export function isTabActive(tab: NavTab, pathname: string): boolean {
  if (tab.under.some((path) => pathname.startsWith(path))) return true
  return 'exact' in tab && tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
}
