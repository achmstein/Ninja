import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, type MotionValue } from 'motion/react'
import { Footprints, TimerReset, X } from 'lucide-react'
import { type ReservationViewModel } from '@/api/spaces'
import { cancelMyReservationMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useSecondTick } from '@/lib/clock'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { springOpen } from '@/lib/motion'
import { PlaceIcon, placeNameId } from '@/lib/places'
import { useTickBeat } from '@/lib/tick-beat'
import { toast } from '@/lib/toast'
import { Beat } from '@/components/motion/beats'
import { MorphButton, type MorphPhase } from '@/components/motion/morph-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CountdownRing } from './countdown-ring'

/** Under this many seconds left, the ring and the time turn to a warning */
const HURRY = 120

/**
 * What a reservation holds, while the customer walks over: the hold's time
 * running down round a ring, the place, what to do, and the way to cancel.
 * On `clock` the parts come in one after another, one on each beat; the
 * place's name does not come in at all: it came with the card
 * (placeNameId), the way a dish's photo stays on screen as it opens.
 */
export function ReservationFace({ reservation, clock }: { reservation: ReservationViewModel; clock?: MotionValue<number> }) {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const { left, total } = useHoldTime(reservation)
  const hurry = left != null && left <= HURRY
  const forTime = reservation.for
    ? new Date(reservation.for).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className='flex min-h-full flex-col items-center justify-between gap-6 px-5 py-7 text-center'>
      <Beat clock={clock} at={0}>
        <span className='flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-caption font-bold text-amber-500'>
          <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
          {t('ninjaHeldFor')}
        </span>
      </Beat>

      {/* What is held, under the time it is held for */}
      <div className='flex flex-col items-center gap-4'>
        <Beat clock={clock} at={0.1}>
          {left != null ? (
            <CountdownRing left={left} total={total ?? left} hurry={hurry} clock={clock} />
          ) : (
            <PlaceIcon kind={Number(reservation.placeKind)} className='size-16' />
          )}
        </Beat>
        <div className='flex flex-col items-center gap-1'>
          <motion.span
            layoutId={placeNameId(reservation.placeId)}
            transition={springOpen}
            className='heading text-title w-fit'
          >
            {localized(reservation.placeName)}
          </motion.span>
          {forTime && (
            <Beat clock={clock} at={0.3}>
              <span className='text-muted-foreground text-note font-medium'>{t('ninjaHoldFor', { time: forTime })}</span>
            </Beat>
          )}
        </div>
      </div>

      <Beat clock={clock} at={0.45} className='flex flex-col items-center gap-2'>
        <span className='flex items-center gap-2 text-body font-semibold'>
          <Footprints className='size-4 shrink-0' />
          {left === 0 ? t('ninjaHoldRanOut') : t('ninjaHoldWalkOver')}
        </span>
        {reservation.startOnConfirm && (
          <span className='text-muted-foreground flex flex-wrap items-center justify-center gap-1.5 text-caption'>
            <TimerReset className='size-3.5 shrink-0' />
            {t('timeStartsOnConfirm')}
            {/* The rate they asked to start at, where the tariff has a choice */}
            {reservation.requestedOptionName && (
              <span className='bg-muted rounded-full px-2 py-0.5 text-caption font-semibold'>{localized(reservation.requestedOptionName)}</span>
            )}
          </span>
        )}
      </Beat>

      <Beat clock={clock} at={0.6} className='w-60'>
        <CancelHold reservationId={Number(reservation.id)} />
      </Beat>
    </div>
  )
}

/** The hold's window, from when it was made to when it lapses, in seconds; nothing where it does not lapse */
function useHoldTime(reservation: ReservationViewModel) {
  const expires = reservation.expiresAt ? new Date(reservation.expiresAt).getTime() : null
  const made = reservation.createdAt ? new Date(reservation.createdAt).getTime() : null
  const now = useSecondTick(expires != null)
  return {
    left: expires != null ? Math.max(0, (expires - now) / 1000) : null,
    total: expires != null && made != null ? Math.max(1, (expires - made) / 1000) : null,
  }
}

/**
 * One button through the whole cancel: the question, a spinner, then the
 * tick. The tick has the same beat as the book button's: the reservation
 * stays as it is until the beat is over, however soon the hold's going
 * comes back, then closes back into its place's card.
 */
function CancelHold({ reservationId }: { reservationId: number }) {
  const t = useT()
  const queryClient = useQueryClient()
  const startTickBeat = useTickBeat((s) => s.start)
  const [asking, setAsking] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const cancel = useMutation({
    ...cancelMyReservationMutation(),
    onSuccess: () => {
      setCancelled(true)
      startTickBeat()
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyReservations' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    },
    onError: () => toast.error(t('failedToCancelReservation')),
  })
  const phase: MorphPhase = cancelled ? 'success' : cancel.isPending ? 'busy' : 'idle'

  return (
    <>
      <MorphButton
        phase={phase}
        height={44}
        onClick={() => setAsking(true)}
        // On the dark reservation: its own light-on-dark, until the tick's green
        className={phase === 'success' ? undefined : 'bg-background/12 text-background font-semibold shadow-none'}
      >
        <X className='size-4' />
        {t('cancelReservation')}
      </MorphButton>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelReservationQuestion')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className='bg-destructive hover:bg-destructive/90 text-white' onClick={() => cancel.mutate({ path: { id: reservationId } })}>
              {t('cancelReservation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
