import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Bell, Receipt, X } from 'lucide-react'
import {
  createServiceRequest,
  SERVICE_REQUEST,
  type ServiceRequestType,
} from '@/lib/services/notifications'
import { toast } from '@/lib/toast'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useLocalized, useT } from '@/lib/i18n'
import { useOrderDestination } from '@/lib/order-destination'
import { PlaceIcon, placeKindName } from '@/lib/places'
import { useTableStore } from '@/stores/table-store'
import { BranchSwitcher } from './branch-switcher'

const tabPaths = ['/', '/rooms', '/orders', '/profile']

/** Scanning a place's code drops the customer straight on the menu, so this
 *  is the standing reminder of where their order is going - and the way out
 *  of a table if they moved or scanned the wrong sticker.
 *
 *  It follows the same rule checkout does, so a clock starting for them
 *  switches it to that place rather than leaving a stale table on screen. A
 *  running clock is not clearable here: you leave it by the counter ending
 *  it, not by dismissing a chip. */
function DestinationChip() {
  const localized = useLocalized()
  const destination = useOrderDestination()
  const clearTable = useTableStore((s) => s.clearTable)

  if (!destination) return null

  if (destination.kind === 'table') {
    return (
      <TableChip
        placeId={destination.placeId}
        placeKind={destination.placeKind}
        name={localized(destination.name)}
        onLeave={clearTable}
      />
    )
  }

  return (
    <span className='bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium'>
      <PlaceIcon
        kind={destination.placeKind}
        className='h-3.5 w-3.5 shrink-0'
      />
      <span className='max-w-20 truncate'>{localized(destination.name)}</span>
    </span>
  )
}

const REQUEST_COOLDOWN_MS = 60_000

/** The table chip is the table's menu: a waiter, the bill, or leaving it.
 *  Same cooldown as the room's quick actions, so a nervous tap does not
 *  ring the till twice. */
function TableChip({
  placeId,
  placeKind,
  name,
  onLeave,
}: {
  placeId: number
  placeKind: number
  name: string
  onLeave: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<ServiceRequestType | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<Map<number, number>>(
    () => new Map(),
  )

  const send = async (
    type: ServiceRequestType,
    successKey: 'waiterNotified' | 'billRequestSent',
  ) => {
    if ((cooldownUntil.get(type) ?? 0) > Date.now()) {
      toast.info(t('pleaseWaitBeforeRequest'))
      return
    }
    setPending(type)
    try {
      await createServiceRequest({
        requestType: type,
        placeId,
        placeKind: placeKindName(placeKind),
        placeName: { en: name, ar: name },
      })
      setCooldownUntil((map) =>
        new Map(map).set(type, Date.now() + REQUEST_COOLDOWN_MS),
      )
      toast.success(t(successKey))
      setOpen(false)
    } catch {
      toast.error(t('failedToSendRequest'))
    } finally {
      setPending(null)
    }
  }

  const item =
    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent disabled:opacity-50'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium'
        >
          <PlaceIcon kind={placeKind} className='h-3.5 w-3.5 shrink-0' />
          <span className='max-w-20 truncate'>{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-44 p-1'>
        <button
          type='button'
          className={item}
          disabled={pending != null}
          onClick={() => send(SERVICE_REQUEST.callWaiter, 'waiterNotified')}
        >
          <Bell className='h-4 w-4' />
          {t('callWaiter')}
        </button>
        <button
          type='button'
          className={item}
          disabled={pending != null}
          onClick={() => send(SERVICE_REQUEST.receiptToPay, 'billRequestSent')}
        >
          <Receipt className='h-4 w-4' />
          {t('getBill')}
        </button>
        <button
          type='button'
          className={`${item} text-muted-foreground`}
          onClick={() => {
            setOpen(false)
            onLeave()
          }}
        >
          <X className='h-4 w-4' />
          {t('leaveTable')}
        </button>
      </PopoverContent>
    </Popover>
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
