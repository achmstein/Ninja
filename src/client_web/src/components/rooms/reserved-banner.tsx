import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, TimerReset } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type StayViewModel } from '@/api/spaces'
import { cancelMyHoldMutation } from '@/api/spaces/@tanstack/react-query.gen'
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

/** The customer's pending hold, as the amber gradient card from the app:
 *  place name, reserved pill, date/time, whether the clock starts on
 *  arrival, and a cancel link. */
export function ReservedBanner({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const cancelHold = useMutation({
    ...cancelMyHoldMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      toast.success(t('reservationCancelled'))
    },
    onError: () => toast.error(t('failedToCancelReservation')),
  })

  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const reservedAt = stay.createdAt ? new Date(stay.createdAt) : null

  return (
    <div className='flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-yellow-600 to-yellow-600/85 p-5 text-white shadow-lg'>
      <div className='flex items-center gap-2'>
        <PlaceIcon kind={Number(stay.placeKind)} className='h-6 w-6' />
        <span className='text-xl font-bold'>{localized(stay.placeName)}</span>
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
      {stay.startOnConfirm && (
        <span className='flex items-center gap-1.5 text-[13px] text-white/90'>
          <TimerReset className='h-3.5 w-3.5' />
          {t('timerStartsOnArrival')}
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
                cancelHold.mutate({ path: { id: Number(stay.id) } })
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
