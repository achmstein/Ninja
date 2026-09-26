import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, TimerReset, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type ReservationViewModel } from '@/api/spaces'
import { cancelMyReservationMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { springSoft } from '@/lib/motion'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { Slab } from '@/components/ninja/page/parts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { HOLD_LAYOUT_ID } from './hold-form'

/**
 * The customer's pending reservation, while they walk over: the dock's dark
 * slab with the place, the time it is for (or when it was made) set large,
 * whether the clock starts on arrival, and the way to cancel. Booking grows
 * it out of the reserve button's tick.
 */
export function HeldCard({ reservation }: { reservation: ReservationViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const cancelHold = useMutation({
    ...cancelMyReservationMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyReservations' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      toast.success(t('reservationCancelled'))
    },
    onError: () => toast.error(t('failedToCancelReservation')),
  })

  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const when = reservation.for ?? reservation.createdAt
  const reservedAt = when ? new Date(when) : null

  return (
    <Slab layoutId={HOLD_LAYOUT_ID} transition={springSoft} className='isolate flex flex-col gap-4'>
      <PlaceIcon kind={Number(reservation.placeKind)} className='pointer-events-none absolute -end-6 -bottom-8 -z-10 size-40 -rotate-12 opacity-[0.08]' />

      <div className='flex items-center gap-2'>
        <span className='flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold'>
          <PlaceIcon kind={Number(reservation.placeKind)} className='size-4 shrink-0' />
          <span className='truncate'>{localized(reservation.placeName)}</span>
        </span>
        <span className='flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-500'>
          <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
          {t('reserved')}
        </span>
      </div>

      {reservedAt && (
        <div className='flex flex-col'>
          <span className='text-[2.5rem] leading-none font-extrabold tabular-nums'>
            {reservedAt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className='text-muted-foreground mt-1.5 text-sm font-medium'>
            {reservedAt.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {reservation.startOnConfirm && (
        <span className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-[13px]'>
          <TimerReset className='size-3.5 shrink-0' />
          {t('timeStartsOnConfirm')}
          {/* The rate they asked to start at, where the tariff has a choice */}
          {reservation.requestedOptionName && (
            <span className='bg-muted rounded-full px-2 py-0.5 text-xs font-semibold'>
              {localized(reservation.requestedOptionName)}
            </span>
          )}
        </span>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type='button'
            className='bg-muted flex h-10 w-fit items-center gap-1.5 rounded-full ps-3 pe-4 text-[13px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 motion-reduce:transform-none'
            disabled={cancelHold.isPending}
          >
            {cancelHold.isPending ? <Loader2 className='size-4 animate-spin' /> : <X className='size-4' />}
            {t('cancelReservation')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelReservationQuestion')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive hover:bg-destructive/90 text-white'
              onClick={() => cancelHold.mutate({ path: { id: Number(reservation.id) } })}
            >
              {t('cancelReservation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Slab>
  )
}
