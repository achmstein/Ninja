import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { Footprints, Loader2, TimerReset, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type ReservationViewModel } from '@/api/spaces'
import { cancelMyReservationMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { formatClock, useSecondTick } from '@/lib/clock'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { cn } from '@/lib/utils'
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

/** Under this many seconds left, the ring and the time turn to a warning */
const HURRY = 120

/**
 * The reservation's content, while the customer walks over: the hold's
 * time running down round a ring with its digits rolling, the place, what
 * to do, and the way to cancel. `enter` (0 to 1, off the shape's progress in
 * ReservationShape) brings the parts in one after another, one on each
 * beat, the ring drawing itself round on the way; without it they are
 * simply there.
 */
export function ReservationFace({ reservation, enter }: { reservation: ReservationViewModel; enter?: MotionValue<number> }) {
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
    <div className='flex min-h-full flex-col items-center justify-between gap-6 px-5 py-7 text-center'>
      <Beat enter={enter} at={0}>
        <span className='flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-500'>
          <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
          {t('ninjaHeldFor')}
        </span>
      </Beat>

      {/* What is held, under the time it is held for: the card says whose room it is on its own */}
      <div className='flex flex-col items-center gap-4'>
        <Beat enter={enter} at={0.1}>
          {left != null ? <CountdownRing left={left} total={total ?? left} hurry={hurry} enter={enter} /> : <PlaceIcon kind={kind} className='size-16' />}
        </Beat>
        <Beat enter={enter} at={0.3} className='flex flex-col items-center gap-1'>
          <span className='flex items-center gap-2'>
            {left != null && <PlaceIcon kind={kind} className='size-5 shrink-0 opacity-70' />}
            <span className='heading text-[calc(1.75rem*var(--heading-scale))] leading-tight'>{placeName}</span>
          </span>
          {forTime && <span className='text-muted-foreground text-sm font-medium'>{t('ninjaHoldFor', { time: forTime })}</span>}
        </Beat>
      </div>

      <Beat enter={enter} at={0.45} className='flex flex-col items-center gap-2'>
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
      </Beat>

      <Beat enter={enter} at={0.6}>
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
      </Beat>
    </div>
  )
}

/**
 * The time the hold has left, rolling like the tray's total, inside a ring
 * that drains with it. The ring moves once a second, eased across the
 * second, so it runs down rather than ticks.
 */
function CountdownRing({ left, total, hurry, enter }: { left: number; total: number; hurry: boolean; enter?: MotionValue<number> }) {
  // The share left, eased across each second so it drains rather than ticks,
  // times how far the ring has drawn itself in as the reservation arrives
  const share = useMotionValue(Math.max(0.001, left / total))
  useEffect(() => {
    const run = animate(share, Math.max(0.001, left / total), { duration: 1, ease: 'linear' })
    return () => run.stop()
  }, [share, left, total])
  const still = useMotionValue(1)
  const drawn = useTransform(enter ?? still, (v) => within(v, 0.15, 0.8))
  const pathLength = useTransform([drawn, share], ([d, s]: number[]) => d * s)
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
          style={{ pathLength }}
        />
      </svg>
      <Odometer
        value={formatClock(left)}
        className={cn('text-[3.25rem] font-extrabold tracking-tight transition-colors duration-300', hurry && 'text-destructive')}
      />
    </div>
  )
}

/** A progress window of 0..1: where a part starts coming in, and where it has arrived */
const within = (v: number, from: number, to: number) => Math.min(1, Math.max(0, (v - from) / (to - from)))

/** One part of the content on its own beat: it rises and fades in over its window of `enter`, and back out the same way */
function Beat({ enter, at, className, children }: { enter?: MotionValue<number>; at: number; className?: string; children: ReactNode }) {
  const still = useMotionValue(1)
  const shown = useTransform(enter ?? still, (v) => within(v, at, at + 0.35))
  const y = useTransform(shown, (v) => (1 - v) * 14)
  return (
    <motion.div className={className} style={{ opacity: shown, y }}>
      {children}
    </motion.div>
  )
}
