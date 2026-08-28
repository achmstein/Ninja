import { Link, useRouterState } from '@tanstack/react-router'
import { Coffee, Gamepad2, ReceiptText, ShoppingBag, User } from 'lucide-react'
import { cartCount, cartTotal, useCart } from '@/lib/cart'
import { usePrice, useT } from '@/lib/i18n'
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
  const price = usePrice()
  const lines = useCart((s) => s.lines)
  const count = cartCount(lines)
  const total = cartTotal(lines)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // The cart is a pushed full-screen page on mobile (no tab bar), and the
  // floating cart bar belongs to the menu screen only — mobile parity.
  if (pathname.startsWith('/cart')) return null
  const onMenuPage = pathname === '/'

  return (
    <>
      {/* Floating "view cart" bar, like the mobile menu screen */}
      {count > 0 && onMenuPage && (
        <div className='fixed inset-x-0 bottom-14 z-40 mx-auto max-w-lg px-4 pb-2 md:hidden'>
          <Link
            to='/cart'
            className='bg-primary text-primary-foreground flex items-center justify-between rounded-full px-5 py-3 text-sm font-semibold shadow-lg'
          >
            <span className='flex items-center gap-2'>
              <ShoppingBag className='h-4 w-4' />
              {t('viewCart')}
              <span className='bg-primary-foreground/20 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs'>
                {count}
              </span>
            </span>
            <span className='tabular-nums'>{price(total)}</span>
          </Link>
        </div>
      )}

      <nav className='bg-background/95 fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t backdrop-blur md:hidden'>
        <div className='flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]'>
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
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
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
    </>
  )
}
