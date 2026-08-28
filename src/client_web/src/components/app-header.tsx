import { Link, useRouterState } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { LogIn, LogOut, ShoppingBag, User } from 'lucide-react'
import { cartCount, useCart } from '@/lib/cart'
import { unregisterPush } from '@/lib/use-push'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BranchSwitcher } from './branch-switcher'

// Mobile IA: primary nav is Menu / Rooms / Orders; everything else lives
// under Profile.
const navLinks: ReadonlyArray<{
  to: '/' | '/rooms' | '/orders'
  key: TranslationKey
  exact?: boolean
}> = [
  { to: '/', key: 'menu', exact: true },
  { to: '/rooms', key: 'rooms' },
  { to: '/orders', key: 'orders' },
]

export function AppHeader() {
  const t = useT()
  const auth = useAuth()
  const count = useCart((s) => cartCount(s.lines))
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const name =
    auth.user?.profile?.name || auth.user?.profile?.preferred_username || ''
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase()

  return (
    <header className='bg-background/95 sticky top-0 z-40 border-b backdrop-blur'>
      <div className='mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4'>
        <Link to='/' className='flex shrink-0 items-center gap-2'>
          <img
            src='/images/cup.png'
            alt=''
            className='size-7 object-contain dark:invert'
          />
          <span className='text-lg font-semibold tracking-tight'>
            {t('appTitle')}
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className='ms-6 hidden items-center gap-1 md:flex'>
          {navLinks.map(({ to, key, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(key)}
              </Link>
            )
          })}
        </nav>

        <div className='ms-auto flex items-center gap-1'>
          <BranchSwitcher />

          {/* Cart lives in the bottom tabs on mobile */}
          <Button
            asChild
            variant='ghost'
            size='icon'
            className='relative hidden scale-95 rounded-full md:inline-flex'
          >
            <Link to='/cart' aria-label={t('cart')}>
              <ShoppingBag className='size-[1.2rem]' />
              {count > 0 && (
                <span className='bg-primary text-primary-foreground absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold'>
                  {count}
                </span>
              )}
            </Link>
          </Button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='hidden scale-95 rounded-full md:inline-flex'
              >
                {auth.isAuthenticated ? (
                  <Avatar className='size-7'>
                    <AvatarFallback className='text-xs'>
                      {initials || <User className='size-4' />}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User className='size-[1.2rem]' />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-44'>
              {auth.isAuthenticated && (
                <>
                  <DropdownMenuLabel className='truncate'>
                    {name}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to='/profile'>{t('profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to='/loyalty'>{t('loyaltyRewards')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {auth.isAuthenticated ? (
                <DropdownMenuItem
                  onClick={async () => {
                    await unregisterPush()
                    auth.signoutRedirect()
                  }}
                >
                  <LogOut className='me-2 size-4' />
                  {t('signOut')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => auth.signinRedirect()}>
                  <LogIn className='me-2 size-4' />
                  {t('signIn')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
