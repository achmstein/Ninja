import { Link } from '@tanstack/react-router'
import { Bell, Check, Hourglass, Loader2, Receipt } from 'lucide-react'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { useServiceRequests } from '@/lib/service-requests'
import {
  SERVICE_REQUEST,
  type ServiceRequestType,
} from '@/lib/services/notifications'
import { cn } from '@/lib/utils'
import {
  useActivePlaceConfirmed,
  usePlaceStore,
  type StoredPlace,
} from '@/stores/place-store'
import { Button } from '@/components/ui/button'
import { TablePayButton } from '@/components/pay/bill-pay'
import { StillHereCard } from './still-here'

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
      {/* The table card, in the clock card's clothes, flush with the
          sheet's top and carrying its drag handle */}
      <div className='from-primary to-primary/85 text-primary-foreground flex flex-col items-center gap-3 bg-gradient-to-br p-6 pt-3'>
        <div className='mb-3 h-1 w-10 rounded-full bg-white/40' />
        <div className='flex size-14 items-center justify-center rounded-full bg-white/15'>
          <PlaceIcon kind={place.kind} className='h-7 w-7' />
        </div>
        <span className='text-2xl font-bold'>{localized(place.name)}</span>
        <span className='text-sm opacity-80'>
          {t('sinceTime', { time: since })}
        </span>
      </div>

      <div className='flex flex-col gap-4 px-4'>
        {!confirmed && <StillHereCard place={place} />}

        <div className='grid grid-cols-2 gap-3'>
          <RequestPill
            type={SERVICE_REQUEST.callWaiter}
            icon={Bell}
            label={t('callWaiter')}
            requests={requests}
            locked={!confirmed}
          />
          <RequestPill
            type={SERVICE_REQUEST.receiptToPay}
            icon={Receipt}
            label={t('getBill')}
            requests={requests}
            locked={!confirmed}
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
          className='text-muted-foreground self-center text-sm underline'
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

/** One request as a pill that is also its status: tap to send, tap again
 *  to take it back while it is only sent, then "on the way" with who is
 *  coming once the till picks it up. The open request is the cooldown; no
 *  toast asks anyone to wait. */
function RequestPill({
  type,
  icon: Icon,
  label,
  requests,
  locked = false,
}: {
  type: ServiceRequestType
  icon: React.ComponentType<{ className?: string }>
  label: string
  requests: ReturnType<typeof useServiceRequests>
  /** Nothing goes out until the session has vouched for the table */
  locked?: boolean
}) {
  const t = useT()
  const state = requests.stateOf(type)

  return (
    <Button
      variant='outline'
      className={cn(
        'h-16 flex-col gap-0.5 rounded-2xl text-sm font-semibold',
        state.phase === 'sent' && 'border-primary/30 bg-primary/5',
        state.phase === 'onTheWay' &&
          'border-primary/30 bg-primary/10 text-primary',
      )}
      disabled={
        locked || requests.pending != null || state.phase === 'onTheWay'
      }
      onClick={() => requests.tap(type)}
    >
      {state.phase === 'sending' ? (
        <Loader2 className='h-5 w-5 animate-spin' />
      ) : state.phase === 'sent' ? (
        <Hourglass className='h-5 w-5' />
      ) : state.phase === 'onTheWay' ? (
        <Check className='h-5 w-5' />
      ) : (
        <Icon className='h-5 w-5' />
      )}
      {state.phase === 'sent' ? (
        <>
          <span>{`${label} · ${t('sent')}`}</span>
          <span className='text-muted-foreground text-[11px] font-normal'>
            {t('tapToCancel')}
          </span>
        </>
      ) : state.phase === 'onTheWay' ? (
        <span className='truncate'>
          {state.by ? t('onTheWayBy', { name: state.by }) : t('onTheWay')}
        </span>
      ) : (
        <span>{label}</span>
      )}
    </Button>
  )
}
