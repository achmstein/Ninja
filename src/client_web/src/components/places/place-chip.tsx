import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { useLocalized } from '@/lib/i18n'
import { useOrderDestination } from '@/lib/order-destination'
import { PlaceIcon } from '@/lib/places'
import { useServiceRequests } from '@/lib/service-requests'
import { SERVICE_REQUEST } from '@/lib/services/notifications'
import { cn } from '@/lib/utils'
import { useActivePlace, useActivePlaceConfirmed } from '@/stores/place-store'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { TableView } from './table-view'

/**
 * Where the customer is, as a chip in the bar on every tab: the table they
 * scanned, or the place their clock runs in. The table chip is the table's
 * door (docs/visit-tab.html): tapping it slides the table up as a sheet —
 * the hero, the waiter and the bill, the tab, the way out — so the places
 * to book keep their own tab and the table is one tap away from anywhere.
 * A running clock is not opened here: its tab is where it lives, and you
 * leave it by the counter ending it, not by dismissing a chip.
 */
export function DestinationChip() {
  const localized = useLocalized()
  const destination = useOrderDestination()

  if (!destination) return null

  if (destination.kind === 'place') return <TableChip />

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

function TableChip() {
  const localized = useLocalized()
  const place = useActivePlace()
  const confirmed = useActivePlaceConfirmed()
  const [open, setOpen] = useState(false)

  // A dot on the chip while something is asked for, so the answer is one
  // tap away from any tab
  const requests = useServiceRequests({
    placeId: place?.id ?? 0,
    placeKind: place?.kind ?? 0,
    placeName: place?.name ?? {},
  })
  const asking =
    requests.stateOf(SERVICE_REQUEST.callWaiter).phase !== 'idle' ||
    requests.stateOf(SERVICE_REQUEST.receiptToPay).phase !== 'idle'

  if (!place) return null

  return (
    <>
      <button
        type='button'
        aria-label={localized(place.name)}
        className={cn(
          'relative flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          confirmed
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'bg-muted text-muted-foreground',
        )}
        onClick={() => setOpen(true)}
      >
        {/* A table from an earlier session shows as a question until answered */}
        {confirmed ? (
          <PlaceIcon kind={place.kind} className='h-3.5 w-3.5 shrink-0' />
        ) : (
          <CircleHelp className='h-3.5 w-3.5 shrink-0' />
        )}
        <span className='max-w-24 truncate'>{localized(place.name)}</span>
        {asking && (
          <span className='bg-primary absolute -end-0.5 -top-0.5 size-2 rounded-full' />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side='bottom'
          className='mx-auto max-w-lg gap-0 overflow-hidden rounded-t-2xl border-t-0 p-0 pb-[env(safe-area-inset-bottom)] [&>button]:text-white'
        >
          <SheetTitle className='sr-only'>{localized(place.name)}</SheetTitle>
          <div className='max-h-[85svh] overflow-y-auto'>
            <TableView place={place} onClose={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
