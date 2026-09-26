import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import { AnimatePresence, motion } from 'motion/react'
import { Clock } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type PlaceViewModel } from '@/api/spaces'
import { reservePlaceMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { holdOrigin } from '@/lib/hold-origin'
import { spring, springSoft } from '@/lib/motion'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { hasOptions, optionColor, tariffOptions } from '@/lib/places'
import { cn } from '@/lib/utils'
import { MorphButton, type MorphPhase } from '@/components/motion/morph-button'
import { Switch } from '@/components/ui/switch'

/** How long the tick shows before anything else moves, ms: the card only becomes the reservation after it */
const SUCCESS_HOLD_MS = 700

/**
 * Booking a place, as the app does it: the ten-minute window, the start-now
 * switch with the rate to start at, one button. It slides in under a place's
 * card on the tab, and sits in the sheet a scanned code opens. The button
 * becomes a spinner and then a tick, and the tick grows into the reservation
 * (components/places/reservation-shape).
 */
export function HoldForm({
  place,
  onDone,
  className,
}: {
  place: PlaceViewModel
  /** The hold went through or was turned down; whoever showed the form puts it away */
  onDone: (outcome: 'booked' | 'failed') => void
  className?: string
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [startOnConfirm, setStartOnConfirm] = useState(false)
  // The rate the clock starts at when it starts on Confirm: the tariff's
  // first option until the customer picks another
  const [optionCode, setOptionCode] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)
  const button = useRef<HTMLDivElement>(null)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyReservations' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getPlace' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'scanPlace' }] })
  }, [queryClient])

  const hold = useMutation({
    ...reservePlaceMutation(),
    // Nothing is re-read until the tick has had its beat: the hold arriving
    // is what turns the card into the reservation, so it waits its turn
    onSuccess: () => {
      toast.success(t('roomReservedSuccess'))
      setBooked(true)
    },
    onError: (error) => {
      // The backend rejects double bookings with a clear reason — show it
      const detail = isAxiosError(error) && (error.response?.data as { detail?: string } | undefined)?.detail
      toast.error(detail || t('failedToReserveRoom'))
      invalidate()
      onDone('failed')
    },
  })

  // The tick shows for a moment, then the form goes. The latest onDone is
  // kept aside so the page re-rendering under the tick does not restart it
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (!booked) return
    const timer = window.setTimeout(() => {
      // Where the tick is now is where the reservation grows out of
      holdOrigin.set(button.current?.querySelector('button')?.getBoundingClientRect())
      invalidate()
      done.current('booked')
    }, SUCCESS_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [booked, invalidate])

  const options = tariffOptions(place.tariff)
  const pickRate = startOnConfirm && hasOptions(place.tariff)
  const chosenCode = optionCode ?? options[0]?.code ?? null
  const phase: MorphPhase = booked ? 'success' : hold.isPending ? 'busy' : 'idle'

  const step = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...springSoft, delay: 0.06 + i * 0.05 },
  })

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <motion.div {...step(0)} className='flex items-center gap-3'>
        <span className='bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full'>
          <Clock className='size-5' />
        </span>
        <span className='text-[15px] font-semibold'>{t('fifteenMinutesToArrive')}</span>
      </motion.div>

      {/* The clock starts the moment the counter confirms the reservation,
          instead of waiting for the cashier to start it. A place with no
          clock has nothing to start */}
      {place.isTimed && (
        <motion.label {...step(1)} className='bg-muted/60 flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2'>
          <span className='flex-1 text-sm font-medium'>{t('startTimeNow')}</span>
          <Switch checked={startOnConfirm} onCheckedChange={setStartOnConfirm} />
        </motion.label>
      )}

      {/* Which rate the clock starts at, where the tariff has a choice: the
          customer picks here, so the till confirms without asking */}
      <AnimatePresence initial={false}>
        {pickRate && (
          <motion.div
            key='rates'
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springSoft}
            className='overflow-hidden'
          >
            <p className='text-muted-foreground px-1 pb-2 text-[13px] font-semibold'>{t('bookStartAt')}</p>
            <div role='radiogroup' className='bg-muted flex gap-1 rounded-[1.25rem] p-1'>
              {options.map((option) => {
                const selected = option.code === chosenCode
                const color = optionColor(place.tariff, option.code)
                return (
                  <button
                    key={option.code}
                    type='button'
                    role='radio'
                    aria-checked={selected}
                    onClick={() => setOptionCode(option.code ?? null)}
                    className='relative flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-2xl px-3 py-2.5 text-start'
                  >
                    {/* The same liquid pill as the menu's dial: it slides to the rate picked */}
                    {selected && (
                      <motion.span
                        layoutId={`rate-${place.id}`}
                        transition={spring}
                        aria-hidden
                        className='bg-background absolute inset-0 rounded-2xl shadow-[0_1px_3px_rgb(0_0_0/0.12)]'
                      />
                    )}
                    <span className='relative flex items-center gap-1.5 text-sm font-semibold'>
                      <span className={cn('size-2 rounded-full', color.dot)} />
                      {localized(option.name)}
                    </span>
                    <span className='text-muted-foreground relative text-xs tabular-nums'>
                      {t('hourlyRateFormat', { rate: price.whole(option.hourlyRate) })}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div ref={button} {...step(2)} className='flex justify-center pt-1'>
        <MorphButton
          phase={phase}
          height={48}
          className='font-bold'
          onClick={() =>
            hold.mutate({
              body: {
                placeId: Number(place.id),
                customerName: auth.user?.profile?.name || auth.user?.profile?.preferred_username || null,
                notes: null,
                startOnConfirm,
                optionCode: pickRate ? chosenCode : null,
              },
            })
          }
        >
          {t('reserveNow')}
        </MorphButton>
      </motion.div>
    </div>
  )
}
