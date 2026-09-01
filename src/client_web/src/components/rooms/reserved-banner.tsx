import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Gamepad2, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type ReservationViewModel } from '@/api/spaces'
import { cancelMyReservationMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/** The customer's pending reservation, as the amber gradient card from the
 *  mobile app: room name, reserved pill, date/time, and a cancel link. */
export function ReservedBanner({
  session,
}: {
  session: ReservationViewModel
}) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()

  const cancelReservation = useMutation({
    ...cancelMyReservationMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMySessions' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      toast.success(t('reservationCancelled'))
    },
    onError: () => toast.error(t('failedToCancelReservation')),
  })

  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const reservedAt = session.createdAt ? new Date(session.createdAt) : null

  return (
    <div className='flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-yellow-600 to-yellow-600/85 p-5 text-white shadow-lg'>
      <div className='flex items-center gap-2'>
        <Gamepad2 className='h-6 w-6' />
        <span className='text-xl font-bold'>{localized(session.roomName)}</span>
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
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type='button'
            className='mt-2 flex items-center gap-1.5 text-[13px] text-white/90 underline disabled:opacity-70'
            disabled={cancelReservation.isPending}
          >
            {cancelReservation.isPending && (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            )}
            {t('cancelReservation')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelReservationQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmCancelReservation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('noKeep')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() =>
                cancelReservation.mutate({
                  path: { sessionId: Number(session.id) },
                })
              }
            >
              {t('yesCancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
