import { Link } from '@tanstack/react-router'
import { Bell, Receipt } from 'lucide-react'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { useServiceRequests } from '@/lib/service-requests'
import { SERVICE_REQUEST } from '@/lib/services/notifications'
import {
  useActivePlaceConfirmed,
  usePlaceStore,
  type StoredPlace,
} from '@/stores/place-store'
import { Button } from '@/components/ui/button'
import { TablePayButton } from '@/components/pay/bill-pay'
import { StillHereCard } from './still-here'
import { RequestTile } from './request-tile'

/**
 * The customer's table while they sit at it with no clock running, as the
 * sheet the chip opens (docs/visit-tab.html): the table as the hero on the
 * sheet's own top edge, the two things they can ask for as pills that turn
 * into "sent", the way into the menu, and the way out of the table. No tab
 * here: the table's orders stay on the Orders tab, so a long list never
 * sits next to the waiter button.
 */
export function TableView({
  place,
  onClose,
}: {
  place: StoredPlace
  /** Called when the view sends the customer elsewhere or off the table */
  onClose: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  // A table from an earlier session is asked about before anything is sent
  const confirmed = useActivePlaceConfirmed()

  const requests = useServiceRequests({
    placeId: place.id,
    placeKind: place.kind,
    placeName: place.name,
  })

  const since = new Date(place.scannedAt).toLocaleTimeString(
    language === 'ar' ? 'ar-EG' : 'en-US',
    { hour: 'numeric', minute: '2-digit' },
  )

  return (
    <div className='flex flex-col gap-4 pb-4'>
      {/* The table, set at the top of the sheet, which is the dock's dark slab itself */}
      <div className='relative isolate flex flex-col items-center gap-3 overflow-hidden p-6'>
        <PlaceIcon kind={place.kind} className='pointer-events-none absolute -end-6 -bottom-8 -z-10 size-40 -rotate-12 opacity-[0.08]' />
        <div className='bg-muted flex size-14 items-center justify-center rounded-full'>
          <PlaceIcon kind={place.kind} className='h-7 w-7' />
        </div>
        <span className='heading text-title'>{localized(place.name)}</span>
        <span className='text-note opacity-80'>
          {t('sinceTime', { time: since })}
        </span>
      </div>

      <div className='flex flex-col gap-4 px-4'>
        {!confirmed && <StillHereCard place={place} />}

        <div className='grid grid-cols-2 gap-3'>
          <RequestTile
            icon={Bell}
            label={t('callWaiter')}
            state={requests.stateOf(SERVICE_REQUEST.callWaiter)}
            busy={requests.pending != null}
            locked={!confirmed}
            onTap={() => void requests.tap(SERVICE_REQUEST.callWaiter)}
          />
          <RequestTile
            icon={Receipt}
            label={t('getBill')}
            state={requests.stateOf(SERVICE_REQUEST.receiptToPay)}
            busy={requests.pending != null}
            locked={!confirmed}
            onTap={() => void requests.tap(SERVICE_REQUEST.receiptToPay)}
          />
        </div>

        {/* The table's bill, whoever ordered it: a guest who ordered
            nothing can still pay for the round. Once the session has
            vouched for the table, like the requests */}
        {confirmed && (
          <TablePayButton placeId={place.id} branchId={place.branchId} />
        )}

        <Button asChild size='lg' className='w-full rounded-pill'>
          <Link to='/' onClick={onClose}>
            {t('orderFromMenu')}
          </Link>
        </Button>

        {/* Moved, or scanned the wrong sticker */}
        <button
          type='button'
          className='text-muted-foreground self-center text-note underline'
          onClick={() => {
            clearPlace()
            onClose()
          }}
        >
          {t('leaveTable')}
        </button>
      </div>
    </div>
  )
}
