import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  Clock,
  LogOut,
  Play,
  Receipt,
  Square,
  TimerReset,
  User,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { getOpenTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type {
  PlaceViewModel,
  ReservationViewModel,
  StayViewModel,
} from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  CustomerCard,
  type CardCustomer,
} from '@/features/customer/customer-card'
import { CustomerDialog } from '@/features/sale/customer-dialog'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { RateOptionToggle } from './rate-option-toggle'
import { StayMembers } from './stay-members'
import { StartStayDialog } from './start-stay-dialog'
import {
  elapsedSeconds,
  expiresInSeconds,
  findOption,
  formatBillingHours,
  formatClock,
  hasOptions,
  isHolding,
  isRunning,
  isTimed,
  optionSeconds,
  PLACE_OUT_OF_SERVICE,
  placeStatusDot,
  stayBilledHours,
  tariffLine,
  tariffOptions,
} from './status'
import { useSecondsClock, useStayActions } from './use-places'

type PlacePanelProps = {
  /** The place to show; null keeps the panel closed. */
  place: PlaceViewModel | null
  /** The running stay on it, if any. */
  stay: StayViewModel | undefined
  /** The next reservation on it, if any; only one keeping the place now shows. */
  reservation?: ReservationViewModel | undefined
  onOpenChange: (open: boolean) => void
  /**
   * A clock started from here. The panel closes; the floor takes the
   * till to the bill, where the running stay's card lives.
   */
  onStarted?: (placeId: number) => void
  /** A reservation at a plain table was seated, or its party's bill is asked for: the floor opens it. */
  onSeated?: (place: PlaceViewModel) => void
}

/**
 * One place's live state and every control the till has for it — the
 * admin panel's "now" section, sized for a thumb. A timed place shows its
 * clock; any place shows who reserved it. Hours here; the money is the
 * ticket's, one tap away while the clock runs.
 */
export function PlacePanel({
  place,
  stay,
  reservation,
  onOpenChange,
  onStarted,
  onSeated,
}: PlacePanelProps) {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const locale = useLocale()
  const money = useMoney()
  const navigate = useNavigate()
  const actions = useStayActions()
  const open = place != null
  const now = useSecondsClock(open)

  const [startOpen, setStartOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingOption, setPendingOption] = useState<string | null>(null)
  // Customer picker: adds a member (running) or names the party (reserved)
  const [pickerFor, setPickerFor] = useState<'member' | 'assign' | null>(null)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)

  const running = isRunning(stay)
  const held = !running && reservation != null && isHolding(reservation)
  // A party seated on their reservation at a plain table: theirs until the till clears it
  const seated = !running ? (place?.seatedReservation ?? null) : null
  const timed = isTimed(place, features.timeBilling)
  const outOfService = Number(place?.status) === PLACE_OUT_OF_SERVICE
  const stayId = toNumber(stay?.id)
  const reservationId = toNumber(reservation?.id)
  const options = tariffOptions(place?.tariff)

  // The running stay's bill, for the jump to it
  const { data: tickets } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: open && running,
  })
  const ticket = running
    ? tickets?.find((candidate) => toNumber(candidate.sessionId) === stayId)
    : undefined

  const currentCode = stay?.currentOptionCode ?? null
  const elapsed = running ? elapsedSeconds(stay, now) : 0
  const used = running
    ? options.filter((o) => optionSeconds(stay, o.code, now) > 0)
    : []
  const billed = stay ? stayBilledHours(stay) : 0
  const billedLabel = formatBillingHours(billed, t)
  const expiresIn = held ? expiresInSeconds(reservation, now) : null
  const optionName = (code: string | null) =>
    localized(findOption(stay?.tariff ?? place?.tariff, code)?.name) ||
    code ||
    ''
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
    })

  const close = () => onOpenChange(false)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-xl'>
              <span
                className={cn(
                  'size-3 shrink-0 rounded-full',
                  placeStatusDot[Number(place?.status ?? 0)] ?? 'bg-muted',
                )}
              />
              {localized(place?.name)}
            </DialogTitle>
            <DialogDescription className='text-base tabular-nums'>
              {timed
                ? `${tariffLine(place?.tariff, money, localized)} ${t('perHour')}`
                : localized(place?.description) || t('table')}
            </DialogDescription>
          </DialogHeader>

          {running ? (
            <div className='flex flex-col items-center gap-4'>
              <span className='font-mono text-5xl font-light tracking-widest tabular-nums'>
                {formatClock(elapsed)}
              </span>
              {used.length > 0 && hasOptions(stay.tariff) && (
                <div className='text-muted-foreground flex gap-4 font-mono text-sm'>
                  {used.map((o) => (
                    <span key={o.code}>
                      {localized(o.name)}{' '}
                      {formatClock(optionSeconds(stay, o.code, now))}
                    </span>
                  ))}
                </div>
              )}

              {hasOptions(stay.tariff) && (
                <RateOptionToggle
                  className='w-full'
                  options={tariffOptions(stay.tariff)}
                  value={currentCode}
                  onChange={(code) => {
                    if (code !== currentCode) setPendingOption(code)
                  }}
                  disabled={actions.isBusy}
                />
              )}

              <StayMembers stay={stay} />

              {/* Billed hours in rounding steps; hidden until the first step
                  lands, like the admin panel */}
              {billed > 0 && (
                <div className='w-full rounded-xl border p-3 text-sm'>
                  {(stay.costs ?? [])
                    .filter((c) => Number(c.hours ?? 0) > 0)
                    .map((c) => (
                      <div key={c.optionCode} className='flex justify-between'>
                        <span className='text-muted-foreground'>
                          {hasOptions(stay.tariff)
                            ? localized(c.optionName)
                            : t('time')}
                        </span>
                        <span className='tabular-nums'>
                          {formatBillingHours(c.hours, t)}
                        </span>
                      </div>
                    ))}
                  <Separator className='my-2' />
                  <div className='flex justify-between font-semibold'>
                    <span>{t('billedHours')}</span>
                    <span className='tabular-nums'>{billedLabel}</span>
                  </div>
                </div>
              )}

              <div className='flex w-full flex-col gap-2'>
                {ticket && (
                  <Button
                    variant='outline'
                    size='lg'
                    className='h-12'
                    onClick={() => {
                      close()
                      navigate({
                        to: '/ticket/$ticketId',
                        params: { ticketId: String(toNumber(ticket.id)) },
                      })
                    }}
                  >
                    <Receipt className='size-5' />
                    {t('openTicketAction')} · {money(ticket.total)}
                  </Button>
                )}
                <Button
                  variant='destructive'
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => setConfirmEnd(true)}
                >
                  <Square className='size-5' />
                  {t('endSessionButton')}
                </Button>
                <Button
                  variant='ghost'
                  className='text-muted-foreground h-11'
                  disabled={actions.isBusy}
                  onClick={() => setConfirmCancel(true)}
                >
                  <X className='size-4' />
                  {t('cancelSessionButton')}
                </Button>
              </div>
            </div>
          ) : seated ? (
            <div className='flex flex-col items-center gap-3 py-2'>
              <div className='flex size-16 items-center justify-center rounded-full bg-sky-500/10'>
                <Users className='size-7 text-sky-500' />
              </div>
              <p className='text-lg font-medium'>{t('partySeated')}</p>
              <p className='text-muted-foreground flex items-center gap-1'>
                <User className='size-4' />
                {seated.customerName || t('table')}
                {seated.partySize
                  ? ` · ${t('partyOf', { count: seated.partySize })}`
                  : ''}
              </p>
              {seated.seatedAt && (
                <p className='text-muted-foreground text-sm tabular-nums'>
                  {t('seatedSince', { time: timeOf(seated.seatedAt) })}
                </p>
              )}
              <div className='mt-2 grid w-full grid-cols-2 gap-2'>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => {
                    if (!place) return
                    close()
                    onSeated?.(place)
                  }}
                >
                  <Receipt className='size-5' />
                  {t('openTicketAction')}
                </Button>
                <Button
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() =>
                    actions.completeReservation(toNumber(seated.reservationId), {
                      onSuccess: close,
                    })
                  }
                >
                  <LogOut className='size-5 rtl:rotate-180' />
                  {t('partyLeft')}
                </Button>
              </div>
            </div>
          ) : held ? (
            <div className='flex flex-col items-center gap-3 py-2'>
              <div className='flex size-16 items-center justify-center rounded-full bg-amber-500/10'>
                <Clock className='size-7 text-amber-500' />
              </div>
              <p className='text-lg font-medium'>
                {timed ? t('readyToStart') : t('statusReserved')}
              </p>
              {reservation.customerName ? (
                <p className='text-muted-foreground flex items-center gap-1'>
                  <User className='size-4' />
                  {reservation.customerName}
                  {reservation.partySize
                    ? ` · ${t('partyOf', { count: reservation.partySize })}`
                    : ''}
                </p>
              ) : (
                <Button
                  variant='outline'
                  className='h-11'
                  disabled={actions.isBusy}
                  onClick={() => setPickerFor('assign')}
                >
                  <UserPlus className='size-4' />
                  {t('assignCustomer')}
                </Button>
              )}
              {expiresIn != null && (
                <p className='font-mono text-sm text-amber-600 tabular-nums dark:text-amber-500'>
                  {t('expiresIn', {
                    countdown: formatClock(expiresIn).slice(3),
                  })}
                </p>
              )}
              {/* The customer asked for the clock to start the moment the
                  counter confirms the reservation, at the rate they picked:
                  one tap does both */}
              {reservation.startOnConfirm && (
                <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                  <TimerReset className='size-4' />
                  {t('startsOnConfirm')}
                  {reservation.requestedOptionName && (
                    <Badge variant='secondary'>
                      {localized(reservation.requestedOptionName)}
                    </Badge>
                  )}
                </p>
              )}
              <div className='mt-2 grid w-full grid-cols-2 gap-2'>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => setConfirmCancel(true)}
                >
                  <X className='size-5' />
                  {t('cancel')}
                </Button>
                {!timed ? (
                  <Button
                    size='lg'
                    className='h-12'
                    disabled={actions.isBusy}
                    onClick={() =>
                      actions.seat(reservationId, null, false, {
                        onSuccess: () => {
                          if (!place) return
                          close()
                          onSeated?.(place)
                        },
                      })
                    }
                  >
                    <CheckCircle2 className='size-5' />
                    {t('seatParty')}
                  </Button>
                ) : reservation.startOnConfirm ? (
                  <Button
                    size='lg'
                    className='h-12'
                    disabled={actions.isBusy}
                    onClick={() =>
                      actions.confirm(reservationId, true, {
                        onSuccess: () => {
                          if (!place) return
                          close()
                          onStarted?.(toNumber(place.id))
                        },
                      })
                    }
                  >
                    <Play className='size-5 rtl:rotate-180' />
                    {t('confirmHold')}
                  </Button>
                ) : (
                  <Button
                    size='lg'
                    className='h-12'
                    disabled={actions.isBusy}
                    onClick={() => setStartOpen(true)}
                  >
                    <Play className='size-5 rtl:rotate-180' />
                    {t('startSession')}
                  </Button>
                )}
              </div>
            </div>
          ) : outOfService ? (
            <div className='flex flex-col items-center gap-3 py-4'>
              <div className='bg-muted flex size-16 items-center justify-center rounded-full'>
                <Wrench className='text-muted-foreground size-7' />
              </div>
              <p className='text-muted-foreground text-lg font-medium'>
                {t('underMaintenance')}
              </p>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-3 py-2'>
              <div className='flex size-16 items-center justify-center rounded-full bg-green-500/10'>
                <CheckCircle2 className='size-7 text-green-500' />
              </div>
              <p className='text-lg font-medium'>{t('statusAvailable')}</p>
              {localized(place?.description) && (
                <p className='text-muted-foreground max-w-sm text-center text-sm'>
                  {localized(place?.description)}
                </p>
              )}
              <div className='mt-2 grid w-full grid-cols-2 gap-2'>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => actions.reserve(toNumber(place?.id), null)}
                >
                  <Clock className='size-5' />
                  {t('reserve')}
                </Button>
                <Button
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => setStartOpen(true)}
                >
                  <Play className='size-5 rtl:rotate-180' />
                  {t('startSession')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StartStayDialog
        place={startOpen ? place : null}
        reservation={held ? reservation : null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setStartOpen(false)
        }}
        onStarted={() => {
          if (!place) return
          close()
          onStarted?.(toNumber(place.id))
        }}
      />

      <CustomerCard
        customer={cardFor}
        onOpenChange={(isOpen) => !isOpen && setCardFor(null)}
      />
      <CustomerDialog
        accountsOnly
        open={pickerFor != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPickerFor(null)
        }}
        onSelect={(picked) => {
          if (picked.id) {
            if (pickerFor === 'assign')
              actions.assignReservationCustomer(
                reservationId,
                picked.id,
                picked.name,
              )
            else actions.addMember(stayId, picked.id, picked.name)
          }
          setPickerFor(null)
        }}
      />

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('endThisSession')}
        description={t('endSessionBilledAt', { hours: billedLabel })}
        cancelLabel={t('keepPlaying')}
        actionLabel={t('endSessionButton')}
        destructive
        onAction={() => actions.endStay(stayId)}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={running ? t('cancelThisSession') : t('cancelThisReservation')}
        description={running ? t('cancelSessionHint') : undefined}
        cancelLabel={t('keepIt')}
        actionLabel={
          running ? t('cancelSessionButton') : t('cancelReservation')
        }
        destructive
        // Close the panel once cancelled — otherwise it falls through to the
        // "available" state, re-showing the Start/Reserve options as if
        // prompting to start again.
        onAction={() =>
          running
            ? actions.cancelStay(stayId, { onSuccess: close })
            : actions.cancelReservation(reservationId, { onSuccess: close })
        }
      />

      <ConfirmDialog
        open={pendingOption != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingOption(null)
        }}
        title={t('switchToModeQuestion', { mode: optionName(pendingOption) })}
        cancelLabel={t('keepCurrent', { mode: optionName(currentCode) })}
        actionLabel={t('switchMode')}
        onAction={() => {
          if (pendingOption) actions.changeOption(stayId, pendingOption)
        }}
      />
    </>
  )
}
