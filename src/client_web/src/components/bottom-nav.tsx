import { Link, useRouterState } from '@tanstack/react-router'
import { Coffee, Gamepad2, ReceiptText, User } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useVisitTab } from '@/lib/visit'

// Same four tabs as the mobile app: Menu / Places / Bills / Profile. The
// places tab is where the customer is in the cafe, so its label and icon
// follow the visit (docs/visit-tab.html); Bills is everything the cafe is
// charging them, so the menu never carries orders.
const tabs = [
  { to: '/', key: 'menu', icon: Coffee, exact: true },
  { to: '/places', key: 'rooms', icon: Gamepad2 },
  { to: '/bills', key: 'bills', icon: ReceiptText },
  { to: '/profile', key: 'youTab', icon: User },
] as const

export function BottomNav() {
  const t = useT()
  const visitTab = useVisitTab()
  // Track the *resolved* (committed) location, not the pending one. On a slow
  // navigation the pending location flips to /cart before the heavy cart page
  // paints; reading it here would hide the tab bar while the menu (and its
  // "view cart" pill) is still on screen — a jarring gap. resolvedLocation
  // stays in step with what the Outlet actually shows.
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  })

  // The cart is a pushed full-screen page on mobile (no tab bar) —
  // mobile parity. (The menu's "view cart" pill lives in ViewCartBar.)
  if (pathname.startsWith('/cart')) return null
  // Paying is a page of its own too, like a provider's checkout
  if (pathname.startsWith('/pay/')) return null

  return (
    <nav className='bg-background/95 fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t backdrop-blur md:hidden'>
      {/* A fixed 3.5rem of tabs so the menu's cart strip can anchor at exactly
          this bar's top edge (intrinsic height varied by a few px), plus the
          home indicator's inset under them: the box is border-box, so an
          inset padded inside a bare h-14 squeezed the tabs on an iPhone */}
      <div className='flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-stretch justify-around pb-[env(safe-area-inset-bottom)]'>
        {tabs.map(({ to, key, icon, ...rest }) => {
          // No places to book, no tab: the chip is the table's door
          if (key === 'rooms' && !visitTab.visible) return null
          const active =
            'exact' in rest && rest.exact
              ? pathname === to
              : pathname.startsWith(to)
          const isVisit = key === 'rooms'
          const Icon = isVisit ? visitTab.icon : icon
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className='h-5 w-5' />
              {/* A place's name can be long; the tab keeps its width */}
              <span className='max-w-full truncate px-1'>
                {isVisit ? visitTab.label : t(key)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
