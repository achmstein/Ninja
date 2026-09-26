import { Coffee, Gamepad2, ReceiptText, User } from 'lucide-react'

// Same four tabs as the mobile app: Menu / Places / Bills / Profile. The
// places tab is where the customer is in the cafe, so its label and icon
// follow the visit (docs/visit-tab.html); Bills is everything the cafe is
// charging them, so the menu never carries orders. The bottom bar and the
// Counter template's dock both draw these.
export const NAV_TABS = [
  { to: '/', key: 'menu', icon: Coffee, exact: true },
  { to: '/places', key: 'rooms', icon: Gamepad2 },
  { to: '/bills', key: 'bills', icon: ReceiptText },
  { to: '/profile', key: 'youTab', icon: User },
] as const

export type NavTab = (typeof NAV_TABS)[number]

export function isTabActive(tab: NavTab, pathname: string): boolean {
  return 'exact' in tab && tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
}
