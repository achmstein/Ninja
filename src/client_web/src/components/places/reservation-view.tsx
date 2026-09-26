import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Footprints, Loader2, TimerReset, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type ReservationViewModel } from '@/api/spaces'
import { cancelMyReservationMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { formatClock, useSecondTick } from '@/lib/clock'
import { springSoft } from '@/lib/motion'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { cn } from '@/lib/utils'
import { NinjaPage } from '@/components/ninja/page/page'
import { Slab } from '@/components/ninja/page/parts'
import { Odometer } from '@/components/ninja/odometer'
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
import { VISIT_CARD_ID } from './hold-form'

/** Under this many seconds left, the ring and the time turn to a warning */
const HURRY = 120

/**
 * The customer's reservation, and nothing else, while they walk over: the
 * other places have gone, since one hold is all anyone gets. The slab grows
 * out of the book button's tick; the hold's time runs down round a ring with
 * its digits rolling; once staff start the clock, the same slab becomes the
 * running clock (StayClock shares its layout id).
 */
export function ReservationView({ reservation }: { reservation: ReservationViewModel }) {
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
  const placeName = localized(reservation.placeName)
  const kind = Number(reservation.placeKind)
  const forTime = reservation.for
    ? new Date(reservation.for).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    : null

  // The hold's window: from when it was made to when it lapses
  const expires = reservation.expiresAt ? new Date(reservation.expiresAt).getTime() : null
  const made = reservation.createdAt ? new Date(reservation.createdAt).getTime() : null
  const now = useSecondTick(expires != null)
  const left = expires != null ? Math.max(0, (expires - now) / 1000) : null
  const total = expires != null && made != null ? Math.max(1, (expires - made) / 1000) : null
  const hurry = left != null && left <= HURRY

  return (
    <NinjaPage title={placeName} subtitle={forTime ? t('ninjaHoldFor', { time: forTime }) : undefined}>
      <Slab
        layoutId={VISIT_CARD_ID}
        transition={springSoft}
        className='isolate flex min-h-[calc(100svh-17rem)] flex-col items-center justify-between gap-6 py-7 text-center'
      >
        <PlaceIcon kind={kind} className='pointer-events-none absolute -end-10 -bottom-10 -z-10 size-56 -rotate-12 opacity-[0.07]' />

        <span className='flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-500'>
          <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
          {t('ninjaHeldFor')}
        </span>

        {left != null ? (
          <CountdownRing left={left} total={total ?? left} hurry={hurry} />
        ) : (
          <div className='flex flex-col items-center gap-2'>
            <PlaceIcon kind={kind} className='size-16' />
            <span className='heading text-[calc(2.5rem*var(--heading-scale))] leading-none'>{forTime ?? placeName}</span>
          </div>
        )}

        <div className='flex flex-col items-center gap-2'>
          <span className='flex items-center gap-2 text-[15px] font-semibold'>
            <Footprints className='size-4 shrink-0' />
            {left === 0 ? t('ninjaHoldRanOut') : t('ninjaHoldWalkOver')}
          </span>
          {reservation.startOnConfirm && (
            <span className='text-muted-foreground flex flex-wrap items-center justify-center gap-1.5 text-[13px]'>
              <TimerReset className='size-3.5 shrink-0' />
              {t('timeStartsOnConfirm')}
              {/* The rate they asked to start at, where the tariff has a choice */}
              {reservation.requestedOptionName && (
                <span className='bg-muted rounded-full px-2 py-0.5 text-xs font-semibold'>{localized(reservation.requestedOptionName)}</span>
              )}
            </span>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type='button'
              className='bg-muted flex h-11 items-center gap-1.5 rounded-full ps-4 pe-5 text-sm font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 motion-reduce:transform-none'
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
    </NinjaPage>
  )
}

/**
 * The time the hold has left, rolling like the tray's total, inside a ring
 * that drains with it. The ring moves once a second, eased across the
 * second, so it runs down rather than ticks.
 */
function CountdownRing({ left, total, hurry }: { left: number; total: number; hurry: boolean }) {
  const size = 216
  const stroke = 10
  const r = (size - stroke) / 2
  return (
    <div className='relative grid place-items-center' style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className='absolute inset-0 -rotate-90 rtl:scale-x-[-1]' aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='currentColor' strokeOpacity={0.12} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke='currentColor'
          strokeWidth={stroke}
          strokeLinecap='round'
          className={cn('transition-colors duration-300', hurry ? 'text-destructive' : 'text-amber-400')}
          initial={{ pathLength: 1 }}
          animate={{ pathLength: Math.max(0.001, left / total) }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </svg>
      <Odometer
        value={formatClock(left)}
        className={cn('text-[3.25rem] font-extrabold tracking-tight transition-colors duration-300', hurry && 'text-destructive')}
      />
    </div>
  )
}
