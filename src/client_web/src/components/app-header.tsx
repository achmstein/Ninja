import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { LogIn, LogOut, ShoppingBag, User } from 'lucide-react'
import { cartCount, useCart } from '@/lib/cart'
import { unregisterPush } from '@/lib/use-push'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useVisitTab } from '@/lib/visit'
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
import { DestinationChip } from '@/components/places/place-chip'
import { BranchSwitcher } from './branch-switcher'
import { SignInSheet } from './sign-in-options'
import { useFeatures } from '@/lib/brand'
import { BrandWordmark } from '@/components/brand-mark'

// Mobile IA: primary nav is Menu / Places / Bills; everything else lives
// under Profile. The places link is named after the visit.
const navLinks: ReadonlyArray<{
  to: '/' | '/places' | '/bills'
  key: TranslationKey
  exact?: boolean
}> = [
  { to: '/', key: 'menu', exact: true },
  { to: '/places', key: 'rooms' },
  { to: '/bills', key: 'bills' },
]

export function AppHeader() {
  const features = useFeatures()
  const t = useT()
  const visitTab = useVisitTab()
  const auth = useAuth()
  const count = useCart((s) => cartCount(s.lines))
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [signInOpen, setSignInOpen] = useState(false)

  const name =
    auth.user?.profile?.name || auth.user?.profile?.preferred_username || ''
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase()

  // Desktop only — mobile mirrors the app: no app bar, branding lives in
  // the menu page (see MobileTopBar)
  return (
    <header className='bg-background/95 sticky top-0 z-40 hidden border-b backdrop-blur md:block'>
      <div className='mx-auto flex h-(--header-h) w-full max-w-6xl items-center gap-2 px-4'>
        <Link to='/' className='flex shrink-0 items-center gap-2'>
          <BrandWordmark />
        </Link>

        {/* Desktop navigation */}
        <nav className='ms-6 hidden items-center gap-1 md:flex'>
          {navLinks.map(({ to, key, exact }) => {
            // No places to book, no link: the chip is the table's door
            if (key === 'rooms' && !visitTab.visible) return null
            const active = exact ? pathname === to : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {key === 'rooms' ? visitTab.label : t(key)}
              </Link>
            )
          })}
        </nav>

        <div className='ms-auto flex items-center gap-1'>
          {/* The table is one tap away on a tablet at the table too */}
          <DestinationChip />
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
                <span className='bg-primary text-primary-foreground absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[10px] font-bold'>
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
              {features.loyalty && (
                <DropdownMenuItem asChild>
                  <Link to='/loyalty'>{t('loyaltyRewards')}</Link>
                </DropdownMenuItem>
              )}
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
                <DropdownMenuItem onClick={() => setSignInOpen(true)}>
                  <LogIn className='me-2 size-4' />
                  {t('signIn')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  )
}
