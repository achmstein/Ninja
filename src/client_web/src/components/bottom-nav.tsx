import { Link, useRouterState } from '@tanstack/react-router'
import { useBrandLayout } from '@/lib/brand-layout'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useVisitTab } from '@/lib/visit'
import { CounterNavDock } from '@/components/counter/counter-nav'
import { isTabActive, NAV_TABS as tabs } from '@/components/nav-tabs'

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
  const { home, chrome } = useBrandLayout()

  // The cart is a pushed full-screen page on mobile (no tab bar) —
  // mobile parity. (The menu's "view cart" pill lives in ViewCartBar.)
  if (pathname.startsWith('/cart')) return null
  // Paying is a page of its own too, like a provider's checkout
  if (pathname.startsWith('/pay/')) return null
  // The Counter chrome floats the tabs in a dark slab; on the Counter's own
  // menu they are the lower row of the dock the tray sits in
  if (chrome === 'counter') return pathname === '/' && home === 'counter' ? null : <CounterNavDock />

  return (
    <nav className='bg-background/95 fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t backdrop-blur md:hidden'>
      {/* A fixed 3.5rem of tabs so the menu's cart strip can anchor at exactly
          this bar's top edge (intrinsic height varied by a few px), plus the
          home indicator's inset under them: the box is border-box, so an
          inset padded inside a bare h-14 squeezed the tabs on an iPhone */}
      <div className='flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-stretch justify-around pb-[env(safe-area-inset-bottom)]'>
        {tabs.map((tab) => {
          const { to, key, icon } = tab
          // No places to book, no tab: the chip is the table's door
          if (key === 'rooms' && !visitTab.visible) return null
          const active = isTabActive(tab, pathname)
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
