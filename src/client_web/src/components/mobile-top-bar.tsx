import { Link, useRouterState } from '@tanstack/react-router'
import { Armchair, Gamepad2, X } from 'lucide-react'
import { useLocalized, useT } from '@/lib/i18n'
import { useOrderDestination } from '@/lib/order-destination'
import { useTableStore } from '@/stores/table-store'
import { BranchSwitcher } from './branch-switcher'

const tabPaths = ['/', '/rooms', '/orders', '/profile']

/** Scanning a table code drops the customer straight on the menu, so this is
 *  the standing reminder of where their order is going - and the way out of a
 *  table if they moved or scanned the wrong sticker.
 *
 *  It follows the same rule checkout does, so joining a room switches it to the
 *  room rather than leaving a stale table on screen. A room is not clearable
 *  here: you leave it by ending the session, not by dismissing a chip. */
function DestinationChip() {
  const t = useT()
  const localized = useLocalized()
  const destination = useOrderDestination()
  const clearTable = useTableStore((s) => s.clearTable)

  if (!destination) return null

  const isRoom = destination.kind === 'room'
  const Icon = isRoom ? Gamepad2 : Armchair

  return (
    <span
      className={`bg-muted text-muted-foreground flex items-center gap-1 rounded-full py-1 text-xs font-medium ${
        isRoom ? 'px-2.5' : 'ps-2.5 pe-1'
      }`}
    >
      <Icon className='h-3.5 w-3.5' />
      {localized(destination.name)}
      {!isRoom && (
        <button
          type='button'
          onClick={clearTable}
          aria-label={t('leaveTable')}
          className='hover:bg-background/80 rounded-full p-0.5'
        >
          <X className='h-3 w-3' />
        </button>
      )}
    </span>
  )
}

// Mobile parity with the app: no persistent app bar. Every tab gets the same
// row — branding at the start, branch chip at the end — scrolling with the
// content. Pushed pages (cart, item, room…) bring their own back headers.
export function MobileTopBar() {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (!tabPaths.includes(pathname)) return null

  return (
    <div className='mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-3 md:hidden'>
      <Link to='/' className='flex items-center gap-2'>
        <img
          src='/images/cup.png'
          alt=''
          className='size-7 object-contain dark:invert'
        />
        <span className='text-lg font-semibold tracking-tight'>
          {t('appTitle')}
        </span>
      </Link>
      <div className='flex items-center gap-2'>
        <DestinationChip />
        <BranchSwitcher />
      </div>
    </div>
  )
}
