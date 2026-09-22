import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, TimerReset } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type ReservationViewModel } from '@/api/spaces'
import { cancelMyReservationMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
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

/** The customer's pending reservation, as the amber gradient card from
 *  the app: place name, reserved pill, date/time (when it is for, or when
 *  it was made), whether the clock starts on arrival, and a cancel link. */
export function HeldBanner({
  reservation,
}: {
  reservation: ReservationViewModel
}) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const cancelHold = useMutation({
    ...cancelMyReservationMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getMyReservations' }],
      })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      toast.success(t('reservationCancelled'))
    },
    onError: () => toast.error(t('failedToCancelReservation')),
  })

  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const when = reservation.for ?? reservation.createdAt
  const reservedAt = when ? new Date(when) : null

  return (
    <div className='flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-yellow-600 to-yellow-600/85 p-5 text-white shadow-lg'>
      <div className='flex items-center gap-2'>
        <PlaceIcon kind={Number(reservation.placeKind)} className='h-6 w-6' />
        <span className='text-xl font-bold'>
          {localized(reservation.placeName)}
        </span>
      </div>
      <span className='rounded-full bg-white/20 px-3 py-1 text-xs font-medium'>
        {t('reserved')}
      </span>
      {reservedAt && (
        <div className='mt-2 flex flex-col items-center'>
          <span className='font-medium'>
            {reservedAt.toLocaleDateString(locale, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className='text-2xl font-bold text-white/80'>
            {reservedAt.toLocaleTimeString(locale, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}
      {reservation.startOnConfirm && (
        <span className='flex items-center gap-1.5 text-[13px] text-white/90'>
          <TimerReset className='h-3.5 w-3.5' />
          {t('timeStartsOnConfirm')}
          {/* The rate they asked to start at, where the tariff has a choice */}
          {reservation.requestedOptionName && (
            <span className='rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium'>
              {localized(reservation.requestedOptionName)}
            </span>
          )}
        </span>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type='button'
            className='mt-2 flex items-center gap-1.5 text-[13px] text-white/90 underline disabled:opacity-70'
            disabled={cancelHold.isPending}
          >
            {cancelHold.isPending && (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            )}
            {t('cancelReservation')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('cancelReservationQuestion')}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() =>
                cancelHold.mutate({ path: { id: Number(reservation.id) } })
              }
            >
              {t('cancelReservation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
