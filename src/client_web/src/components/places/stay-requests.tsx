import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeftRight, Bell, Check, Gamepad2, Hourglass, Receipt } from 'lucide-react'
import { type StayViewModel } from '@/api/spaces'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { blurSwap } from '@/lib/motion'
import { hasOptions, stayTakesControllerRequests, tariffOptions } from '@/lib/places'
import { useServiceRequests } from '@/lib/service-requests'
import { SERVICE_REQUEST } from '@/lib/services/notifications'
import { cn } from '@/lib/utils'
import { RequestTile } from './request-tile'

/**
 * What the customer can ask for while their clock runs, the same tiles as
 * at a table: the waiter and the bill anywhere, a controller in a console
 * room. Where the tariff has options, the rate under them says what the
 * clock runs at now, and each other option is one plain action, "Switch to
 * Multi", with what it costs once the staff switch it (a tap again takes
 * it back while it is only asked). The Book tab and the dock's
 * room sheet both show it.
 */
export function StayRequests({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const requests = useServiceRequests({
    placeId: Number(stay.placeId),
    placeKind: Number(stay.placeKind),
    placeName: stay.placeName ?? {},
    sessionId: Number(stay.id),
  })
  const busy = requests.pending != null
  const tile = (type: typeof SERVICE_REQUEST.callWaiter | typeof SERVICE_REQUEST.receiptToPay | typeof SERVICE_REQUEST.controllerChange) => ({
    state: requests.stateOf(type),
    busy,
    onTap: () => void requests.tap(type),
  })

  return (
    <div className='flex flex-col gap-3'>
      <div className={cn('grid gap-3', stayTakesControllerRequests(stay) ? 'grid-cols-3' : 'grid-cols-2')}>
        <RequestTile icon={Bell} label={t('callWaiter')} {...tile(SERVICE_REQUEST.callWaiter)} />
        <RequestTile icon={Receipt} label={t('getBill')} {...tile(SERVICE_REQUEST.receiptToPay)} />
        {stayTakesControllerRequests(stay) && (
          <RequestTile icon={Gamepad2} label={t('controller')} {...tile(SERVICE_REQUEST.controllerChange)} />
        )}
      </div>
      {hasOptions(stay.tariff) && <RateSwitch stay={stay} requests={requests} />}
    </div>
  )
}

function RateSwitch({ stay, requests }: { stay: StayViewModel; requests: ReturnType<typeof useServiceRequests> }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const swap = blurSwap(useReducedMotion())
  // Which option was asked for: the till's list says a switch is open, not to what
  const [asked, setAsked] = useState<string | null>(null)
  const state = requests.stateOf(SERVICE_REQUEST.changeOption)
  const open = state.phase !== 'idle'
  const options = tariffOptions(stay.tariff)
  const current = options.find((o) => o.code === stay.currentOptionCode)
  const perHour = (rate: number | string | undefined) => `${price(Number(rate ?? 0))}${t('perHourShort')}`

  return (
    <div className='bg-muted flex flex-col gap-1 rounded-[1.5rem] p-1'>
      {/* Where the clock stands: said, not a control */}
      {current && (
        <div className='flex items-center justify-between gap-3 px-4 pt-3 pb-2'>
          <span className='text-muted-foreground text-xs font-medium'>{t('ninjaRateNow')}</span>
          <span className='text-sm font-semibold'>
            {localized(current.name)} · {perHour(current.hourlyRate)}
          </span>
        </div>
      )}
      {/* Every other option as the one thing it does: ask the staff to switch to it */}
      {options
        .filter((o) => o.code !== stay.currentOptionCode)
        .map((option) => {
          const name = localized(option.name)
          const waiting = open && option.code === asked
          const phase = waiting ? state.phase : 'idle'
          const note =
            phase === 'onTheWay'
              ? t('ninjaStaffSwitching')
              : phase === 'sent'
                ? `${t('sent')} · ${t('tapToCancel')}`
                : t('ninjaRateOnceSwitched', { price: perHour(option.hourlyRate) })
          return (
            <motion.button
              key={option.code}
              type='button'
              whileTap={{ scale: 0.98 }}
              // Another goes while nothing is asked; the one asked is taken back while it is only sent
              disabled={(open && !waiting) || phase === 'onTheWay' || requests.pending != null}
              onClick={() => {
                if (!waiting) setAsked(option.code ?? null)
                void requests.tap(SERVICE_REQUEST.changeOption, option.code)
              }}
              className={cn(
                'flex items-center gap-3 rounded-[1.25rem] p-3 text-start transition-colors duration-300 disabled:cursor-default',
                phase === 'onTheWay' ? 'bg-emerald-500/15' : phase === 'sent' ? 'bg-primary/12' : 'bg-background'
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-300',
                  phase === 'onTheWay' ? 'bg-emerald-500 text-white' : phase === 'sent' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                <AnimatePresence mode='popLayout' initial={false}>
                  <motion.span key={phase} {...swap} className='grid place-items-center'>
                    {phase === 'onTheWay' ? <Check className='size-5' /> : phase === 'sent' ? <Hourglass className='size-5' /> : <ArrowLeftRight className='size-5' />}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className='flex min-w-0 flex-1 flex-col'>
                <span className='text-sm font-semibold'>{t(phase === 'idle' ? 'switchToOption' : 'ninjaSwitchingTo', { option: name })}</span>
                <AnimatePresence mode='popLayout' initial={false}>
                  <motion.span key={note} {...swap} className='text-muted-foreground truncate text-xs'>
                    {note}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.button>
          )
        })}
    </div>
  )
}
