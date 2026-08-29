import { Link, useRouterState } from '@tanstack/react-router'
import { Coffee, Gamepad2, ReceiptText, User } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Same four tabs as the mobile app: Menu / Rooms / Orders / Profile
const tabs = [
  { to: '/', key: 'menu', icon: Coffee, exact: true },
  { to: '/rooms', key: 'rooms', icon: Gamepad2 },
  { to: '/orders', key: 'orders', icon: ReceiptText },
  { to: '/profile', key: 'profile', icon: User },
] as const

export function BottomNav() {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // The cart is a pushed full-screen page on mobile (no tab bar) —
  // mobile parity. (The menu's "view cart" pill lives in ViewCartBar.)
  if (pathname.startsWith('/cart')) return null

  return (
    <nav className='bg-background/95 fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t backdrop-blur md:hidden'>
        {/* Fixed h-14 so the menu's cart strip can anchor at exactly this
            bar's top edge (intrinsic height varied by a few px) */}
        <div className='flex h-14 items-stretch justify-around pb-[env(safe-area-inset-bottom)]'>
          {tabs.map(({ to, key, icon: Icon, ...rest }) => {
            const active =
              'exact' in rest && rest.exact
                ? pathname === to
                : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className='h-5 w-5' />
                {t(key)}
              </Link>
            )
          })}
        </div>
      </nav>
  )
}
