import { Link, useRouterState } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { DestinationChip } from '@/components/places/place-chip'
import { BranchSwitcher } from './branch-switcher'

const tabPaths = ['/', '/places', '/orders', '/profile']

// Mobile parity with the app: no persistent app bar. Every tab gets the same
// row — branding at the start, the place chip and branch chip at the end —
// scrolling with the content. Pushed pages (cart, item, room…) bring their
// own back headers.
export function MobileTopBar() {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (!tabPaths.includes(pathname)) return null

  return (
    <div className='mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-3 md:hidden'>
      <Link to='/' className='flex min-w-0 items-center gap-2'>
        <img
          src='/images/cup.png'
          alt=''
          className='size-7 shrink-0 object-contain dark:invert'
        />
        <span className='truncate text-lg font-semibold tracking-tight'>
          {t('appTitle')}
        </span>
      </Link>
      {/* shrink-0 so the destination chip can never squeeze the branch
          switcher out of reach on a narrow phone */}
      <div className='flex shrink-0 items-center gap-2'>
        <DestinationChip />
        <BranchSwitcher />
      </div>
    </div>
  )
}
