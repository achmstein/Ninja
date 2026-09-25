import { Link, useRouterState } from '@tanstack/react-router'
import { useBrandLayout } from '@/lib/brand-layout'
import { cn } from '@/lib/utils'
import { DestinationChip } from '@/components/places/place-chip'
import { BranchSwitcher } from './branch-switcher'
import { BrandWordmark } from '@/components/brand-mark'
import { MenuBanner } from './menu-banner'

const tabPaths = ['/', '/places', '/bills', '/profile']

// Mobile parity with the app: no persistent app bar. Every tab gets the same
// row — branding at the start, the place chip and branch chip at the end —
// scrolling with the content. Pushed pages (cart, item, room…) bring their
// own back headers. The style may centre the brand, or put the menu under
// the café's cover photo (the other tabs keep the row).
export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { header } = useBrandLayout()

  if (!tabPaths.includes(pathname)) return null

  if (header === 'banner' && pathname === '/') {
    return (
      <MenuBanner className='mx-auto w-full max-w-lg md:hidden'>
        <DestinationChip />
        <BranchSwitcher />
      </MenuBanner>
    )
  }

  const centered = header === 'center'

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-lg px-4 pt-3 md:hidden',
        centered ? 'flex-col items-center gap-2' : 'items-center justify-between'
      )}
    >
      <Link to='/' className='flex min-w-0 items-center gap-2'>
        <BrandWordmark className='max-w-[55vw]' />
      </Link>
      {/* shrink-0 so the destination chip can never squeeze the branch
          switcher out of reach on a narrow phone; centred, the chips drop
          under the brand, and an empty row takes no room */}
      <div className='flex shrink-0 items-center gap-2 empty:hidden'>
        <DestinationChip />
        <BranchSwitcher />
      </div>
    </div>
  )
}
