import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bell, Gamepad2, Hourglass, Receipt } from 'lucide-react'
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
 * room. Where the tariff has options, the rate is a switch under them: the
 * one running is lit, a tap on another asks the till to switch (and a tap
 * again takes it back while it is only asked). The Book tab and the dock's
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

  return (
    <div className='bg-muted flex gap-1 rounded-[1.5rem] p-1'>
      {tariffOptions(stay.tariff).map((option) => {
        const running = option.code === stay.currentOptionCode
        const waiting = open && option.code === asked
        const note = waiting
          ? state.phase === 'onTheWay'
            ? t('onTheWay')
            : `${t('sent')} · ${t('tapToCancel')}`
          : `${price(Number(option.hourlyRate ?? 0))}${t('perHourShort')}`
        return (
          <button
            key={option.code}
            type='button'
            // The running one is where the customer is; another goes while nothing is asked, or takes back what was
            disabled={running || (open && !waiting) || state.phase === 'onTheWay' || requests.pending != null}
            aria-pressed={running}
            onClick={() => {
              if (!waiting) setAsked(option.code ?? null)
              void requests.tap(SERVICE_REQUEST.changeOption, option.code)
            }}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center rounded-[1.25rem] px-3 py-2.5 transition-colors duration-300 disabled:cursor-default',
              running ? 'bg-foreground text-background' : waiting ? 'bg-primary/12' : 'text-foreground'
            )}
          >
            <span className='flex items-center gap-1.5 text-sm font-semibold'>
              {waiting && <Hourglass className='size-3.5' />}
              {localized(option.name)}
            </span>
            <AnimatePresence mode='popLayout' initial={false}>
              <motion.span key={note} {...swap} className={cn('truncate text-xs', running ? 'opacity-70' : 'text-muted-foreground')}>
                {note}
              </motion.span>
            </AnimatePresence>
          </button>
        )
      })}
    </div>
  )
}
