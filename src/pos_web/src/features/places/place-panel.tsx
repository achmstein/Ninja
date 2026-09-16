import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  Clock,
  Play,
  Receipt,
  Square,
  TimerReset,
  User,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react'
import { getOpenTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { PlaceViewModel, StayViewModel } from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { RateOptionToggle } from './rate-option-toggle'
import { StayMembers } from './stay-members'
import { StartStayDialog } from './start-stay-dialog'
import {
  elapsedSeconds,
  findOption,
  formatBillingHours,
  formatClock,
  hasOptions,
  isRunning,
  isHeld,
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
  stay: StayViewModel | undefined
  onOpenChange: (open: boolean) => void
  /**
   * A clock started from here. The panel closes; the floor takes the
   * till to the bill, where the running stay's card lives.
   */
  onStarted?: (placeId: number) => void
}

/**
 * One timed place's live state and every control the till has for it —
 * the admin panel's "now" section, sized for a thumb. Hours here; the
 * money is the ticket's, one tap away while the clock runs.
 */
export function PlacePanel({
  place,
  stay,
  onOpenChange,
  onStarted,
}: PlacePanelProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const navigate = useNavigate()
  const actions = useStayActions()
  const open = place != null
  const now = useSecondsClock(open)

  const [startOpen, setStartOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingOption, setPendingOption] = useState<string | null>(null)
  // Customer picker: adds a member (running) or assigns the owner (held)
  const [pickerFor, setPickerFor] = useState<'member' | 'assign' | null>(null)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)

  const running = isRunning(stay)
  const held = isHeld(stay)
  const outOfService = Number(place?.status) === PLACE_OUT_OF_SERVICE
  const stayId = toNumber(stay?.id)
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
  const expiresInSeconds =
    held && stay.expiresAt
      ? Math.max(0, (new Date(stay.expiresAt).getTime() - now) / 1000)
      : null
  const optionName = (code: string | null) =>
    localized(findOption(stay?.tariff ?? place?.tariff, code)?.name) ||
    code ||
    ''

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
              {tariffLine(place?.tariff, money, localized)} {t('perHour')}
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
          ) : held ? (
            <div className='flex flex-col items-center gap-3 py-2'>
              <div className='flex size-16 items-center justify-center rounded-full bg-amber-500/10'>
                <Clock className='size-7 text-amber-500' />
              </div>
              <p className='text-lg font-medium'>{t('readyToStart')}</p>
              {stay.customerName ? (
                <p className='text-muted-foreground flex items-center gap-1'>
                  <User className='size-4' />
                  {stay.customerName}
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
              {expiresInSeconds != null && (
                <p className='font-mono text-sm text-amber-600 tabular-nums dark:text-amber-500'>
                  {t('expiresIn', {
                    countdown: formatClock(expiresInSeconds).slice(3),
                  })}
                </p>
              )}
              {/* The customer asked for the clock to start the moment the
                  counter confirms they arrived: one tap does both */}
              {stay.startOnConfirm && (
                <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                  <TimerReset className='size-4' />
                  {t('startsOnConfirm')}
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
                {stay.startOnConfirm ? (
                  <Button
                    size='lg'
                    className='h-12'
                    disabled={actions.isBusy}
                    onClick={() =>
                      actions.confirm(stayId, true, {
                        onSuccess: () => {
                          if (!place) return
                          close()
                          onStarted?.(toNumber(place.id))
                        },
                      })
                    }
                  >
                    <Play className='size-5 rtl:rotate-180' />
                    {t('confirmArrival')}
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
        stay={held ? stay : null}
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
              actions.assignCustomer(stayId, picked.id, picked.name)
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
          actions.cancelStay(stayId, running, { onSuccess: close })
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
