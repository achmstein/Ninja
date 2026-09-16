import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  Clock,
  Play,
  Receipt,
  Square,
  Star,
  User,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react'
import { getOpenTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { ReservationViewModel, RoomViewModel } from '@/api/spaces/types.gen'
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
import { CustomerCard, type CardCustomer } from '@/features/customer/customer-card'
import { CustomerDialog } from '@/features/sale/customer-dialog'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { PlayerModeToggle } from './player-mode-toggle'
import { StartSessionDialog } from './start-session-dialog'
import {
  elapsedSeconds,
  formatBillingHours,
  formatClock,
  isActive,
  isReserved,
  modeLabel,
  modeSeconds,
  type PlayerMode,
  ROOM_MAINTENANCE,
  roomStatusDot,
  sessionBilledHours,
} from './status'
import { useSecondsClock, useSessionActions } from './use-rooms'

type RoomPanelProps = {
  /** The room to show; null keeps the panel closed. */
  room: RoomViewModel | null
  session: ReservationViewModel | undefined
  onOpenChange: (open: boolean) => void
  /**
   * A session started from here. The panel closes; the floor takes the
   * till to the bill, where the running session's card lives.
   */
  onStarted?: (roomId: number) => void
}

/**
 * One room's live state and every control the till has for it — the
 * admin room panel's "now" section, sized for a thumb. Hours here; the
 * money is the ticket's, one tap away while a session runs.
 */
export function RoomPanel({ room, session, onOpenChange, onStarted }: RoomPanelProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const navigate = useNavigate()
  const actions = useSessionActions()
  const open = room != null
  const now = useSecondsClock(open)

  const [startOpen, setStartOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingMode, setPendingMode] = useState<PlayerMode | null>(null)
  // Customer picker: adds a member (running) or assigns the owner (reserved)
  const [pickerFor, setPickerFor] = useState<'member' | 'assign' | null>(null)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)

  const active = isActive(session)
  const reserved = isReserved(session)
  const maintenance = Number(room?.displayStatus) === ROOM_MAINTENANCE
  const sessionId = toNumber(session?.id)

  // The running session's bill, for the jump to it
  const { data: tickets } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: open && active,
  })
  const ticket = active
    ? tickets?.find((candidate) => toNumber(candidate.sessionId) === sessionId)
    : undefined

  const currentMode = (session?.currentPlayerMode ?? null) as PlayerMode | null
  const elapsed = active ? elapsedSeconds(session, now) : 0
  const singleSeconds = active ? modeSeconds(session, 'Single', now) : 0
  const multiSeconds = active ? modeSeconds(session, 'Multi', now) : 0
  const billed = session ? sessionBilledHours(session) : 0
  const billedLabel = formatBillingHours(billed, t)
  const expiresInSeconds =
    reserved && session.expiresAt
      ? Math.max(0, (new Date(session.expiresAt).getTime() - now) / 1000)
      : null

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
                  roomStatusDot[Number(room?.displayStatus ?? 0)] ?? 'bg-muted'
                )}
              />
              {localized(room?.name)}
            </DialogTitle>
            <DialogDescription className='text-base tabular-nums'>
              {money(room?.singleRate)} · {money(room?.multiRate)} {t('perHour')}
            </DialogDescription>
          </DialogHeader>

          {active ? (
            <div className='flex flex-col items-center gap-4'>
              <span className='font-mono text-5xl font-light tracking-widest tabular-nums'>
                {formatClock(elapsed)}
              </span>
              {(singleSeconds > 0 || multiSeconds > 0) && (
                <div className='text-muted-foreground flex gap-4 font-mono text-sm'>
                  {singleSeconds > 0 && (
                    <span>
                      {t('playerModeSingle')} {formatClock(singleSeconds)}
                    </span>
                  )}
                  {multiSeconds > 0 && (
                    <span>
                      {t('playerModeMulti')} {formatClock(multiSeconds)}
                    </span>
                  )}
                </div>
              )}

              <PlayerModeToggle
                className='w-full'
                value={currentMode}
                onChange={(mode) => {
                  if (mode && mode !== currentMode) setPendingMode(mode)
                }}
                disabled={actions.isBusy}
              />

              {/* Who is in the room: the owner starred, members removable,
                  and a dashed chip to add the next one */}
              <div className='flex flex-wrap items-center justify-center gap-2'>
                {(session.members ?? []).map((member) => {
                  const isOwner = member.role === 'Owner'
                  return (
                    <Badge
                      key={member.customerId}
                      variant='outline'
                      className='gap-1.5 px-3 py-1.5 text-sm'
                    >
                      {isOwner ? (
                        <Star className='size-3.5 fill-amber-400 text-amber-400' />
                      ) : (
                        <User className='size-3.5' />
                      )}
                      {member.customerId ? (
                        <button
                          type='button'
                          className='underline-offset-4 hover:underline'
                          onClick={() =>
                            setCardFor({
                              id: String(member.customerId),
                              name: member.customerName ?? '',
                            })
                          }
                        >
                          {member.customerName || t('guest')}
                        </button>
                      ) : (
                        member.customerName || t('guest')
                      )}
                      {!isOwner && member.customerId && (
                        <button
                          type='button'
                          aria-label={t('memberRemove')}
                          disabled={actions.isBusy}
                          className='-me-1 flex size-6 items-center justify-center'
                          onClick={() =>
                            actions.removeMember(sessionId, member.customerId!)
                          }
                        >
                          <X className='text-muted-foreground hover:text-destructive size-3.5' />
                        </button>
                      )}
                    </Badge>
                  )
                })}
                {(session.members?.length ?? 0) === 0 && session.customerName && (
                  <span className='text-muted-foreground flex items-center gap-1 text-sm'>
                    <User className='size-4' />
                    {session.customerName}
                  </span>
                )}
                <button
                  type='button'
                  disabled={actions.isBusy}
                  onClick={() => setPickerFor('member')}
                  className='text-muted-foreground hover:text-foreground hover:border-foreground/40 inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm font-medium transition-colors disabled:opacity-50'
                >
                  <UserPlus className='size-4' />
                  {t('addCustomer')}
                </button>
              </div>

              {/* Billed hours in quarter-hour steps; hidden until the first
                  quarter lands, like the admin panel */}
              {billed > 0 && (
                <div className='w-full rounded-xl border p-3 text-sm'>
                  {Number(session.singleRoundedHours ?? 0) > 0 && (
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        {t('playerModeSingle')}
                      </span>
                      <span className='tabular-nums'>
                        {formatBillingHours(session.singleRoundedHours, t)}
                      </span>
                    </div>
                  )}
                  {Number(session.multiRoundedHours ?? 0) > 0 && (
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        {t('playerModeMulti')}
                      </span>
                      <span className='tabular-nums'>
                        {formatBillingHours(session.multiRoundedHours, t)}
                      </span>
                    </div>
                  )}
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
          ) : reserved ? (
            <div className='flex flex-col items-center gap-3 py-2'>
              <div className='flex size-16 items-center justify-center rounded-full bg-amber-500/10'>
                <Clock className='size-7 text-amber-500' />
              </div>
              <p className='text-lg font-medium'>{t('readyToStart')}</p>
              {session.customerName ? (
                <p className='text-muted-foreground flex items-center gap-1'>
                  <User className='size-4' />
                  {session.customerName}
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
          ) : maintenance ? (
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
              {localized(room?.description) && (
                <p className='text-muted-foreground max-w-sm text-center text-sm'>
                  {localized(room?.description)}
                </p>
              )}
              <div className='mt-2 grid w-full grid-cols-2 gap-2'>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => actions.reserve(toNumber(room?.id), null)}
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

      <StartSessionDialog
        room={startOpen ? room : null}
        session={reserved ? session : null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setStartOpen(false)
        }}
        onStarted={() => {
          if (!room) return
          close()
          onStarted?.(toNumber(room.id))
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
              actions.assignCustomer(sessionId, picked.id, picked.name)
            else actions.addMember(sessionId, picked.id, picked.name)
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
        onAction={() => actions.endSession(sessionId)}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={active ? t('cancelThisSession') : t('cancelThisReservation')}
        description={active ? t('cancelSessionHint') : undefined}
        cancelLabel={t('keepIt')}
        actionLabel={active ? t('cancelSessionButton') : t('cancelReservation')}
        destructive
        // Close the panel once cancelled — otherwise it falls through to the
        // "available" state, re-showing the Start/Reserve options as if
        // prompting to start again.
        onAction={() => actions.cancelSession(sessionId, active, { onSuccess: close })}
      />

      <ConfirmDialog
        open={pendingMode != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingMode(null)
        }}
        title={t('switchToModeQuestion', { mode: modeLabel(pendingMode, t) })}
        cancelLabel={t('keepCurrent', { mode: modeLabel(currentMode, t) })}
        actionLabel={t('switchMode')}
        onAction={() => {
          if (pendingMode) actions.changeMode(sessionId, pendingMode)
        }}
      />
    </>
  )
}
