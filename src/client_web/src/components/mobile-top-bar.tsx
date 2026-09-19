import { Link, useRouterState } from '@tanstack/react-router'
import { DestinationChip } from '@/components/places/place-chip'
import { BranchSwitcher } from './branch-switcher'
import { BrandWordmark } from '@/components/brand-mark'

const tabPaths = ['/', '/places', '/bills', '/profile']

// Mobile parity with the app: no persistent app bar. Every tab gets the same
// row — branding at the start, the place chip and branch chip at the end —
// scrolling with the content. Pushed pages (cart, item, room…) bring their
// own back headers.
export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (!tabPaths.includes(pathname)) return null

  return (
    <div className='mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-3 md:hidden'>
      <Link to='/' className='flex min-w-0 items-center gap-2'>
        <BrandWordmark className='max-w-[55vw]' />
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
