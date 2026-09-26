import { Coffee, Gamepad2, ReceiptText, User } from 'lucide-react'

// Same four tabs as the mobile app: Menu / Places / Bills / Profile. The
// places tab is where the customer is in the cafe, so its label and icon
// follow the visit (docs/visit-tab.html); Bills is everything the cafe is
// charging them, so the menu never carries orders. The dock draws these.
// `under` lists the pages pushed from a tab, which keep that tab lit.
export const NAV_TABS = [
  { to: '/', key: 'menu', icon: Coffee, exact: true, under: ['/item/'] },
  { to: '/places', key: 'rooms', icon: Gamepad2, under: ['/p/', '/stays'] },
  { to: '/bills', key: 'bills', icon: ReceiptText, under: ['/receipts/', '/pay/'] },
  { to: '/profile', key: 'youTab', icon: User, under: ['/settings', '/loyalty', '/account', '/claim'] },
] as const

export type NavTab = (typeof NAV_TABS)[number]

export function isTabActive(tab: NavTab, pathname: string): boolean {
  if (tab.under.some((path) => pathname.startsWith(path))) return true
  return 'exact' in tab && tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
}
