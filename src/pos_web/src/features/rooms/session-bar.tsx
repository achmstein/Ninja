import { useState } from 'react'
import { Square, Timer } from 'lucide-react'
import type { ReservationViewModel, RoomViewModel } from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { PlayerModeToggle } from './player-mode-toggle'
import { SessionMembers } from './session-members'
import {
  elapsedSeconds,
  estimateSessionCost,
  formatBillingHours,
  formatClock,
  modeLabel,
  modeSeconds,
  type PlayerMode,
} from './status'
import { useSecondsClock, useSessionActions } from './use-rooms'

/**
 * The running clock on a room ticket. Its time is not on the bill yet — it
 * lands as lines when the session ends — so the card answers the two
 * questions the cashier has while it runs: how long, and how much so far.
 * The mode switches right here (the customers' most common mid-session
 * ask), the people in the room are listed and added right here, and the
 * session ends from here. On the bill itself, customers go on lines with
 * the ticket's own Assign customer.
 */
export function SessionBar({
  session,
  room,
}: {
  session: ReservationViewModel
  room: RoomViewModel | undefined
}) {
  const t = useT()
  const money = useMoney()
  const actions = useSessionActions()
  const now = useSecondsClock(true)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingMode, setPendingMode] = useState<PlayerMode | null>(null)

  const sessionId = toNumber(session.id)
  const currentMode = (session.currentPlayerMode ?? null) as PlayerMode | null
  const singleSeconds = modeSeconds(session, 'Single', now)
  const multiSeconds = modeSeconds(session, 'Multi', now)
  const estimate = room ? estimateSessionCost(session, room, now) : null
  const hoursLabel = formatBillingHours(estimate?.hours ?? 0, t)

  return (
    <>
      <div className='bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-3 shadow-xs'>
        {/* How long, and how much: the clock leads, the money answers */}
        <div className='flex items-start gap-3'>
          <Timer className='text-muted-foreground mt-1 size-6 shrink-0' />
          <div className='min-w-0 flex-1'>
            <div className='font-mono text-3xl tabular-nums'>
              {formatClock(elapsedSeconds(session, now))}
            </div>
            {/* Per-mode split only once both modes have been used */}
            {singleSeconds > 0 && multiSeconds > 0 && (
              <div className='text-muted-foreground truncate text-sm tabular-nums'>
                {t('playerModeSingle')} {formatClock(singleSeconds)}
                {' · '}
                {t('playerModeMulti')} {formatClock(multiSeconds)}
              </div>
            )}
          </div>
          {estimate && (
            <div className='shrink-0 text-end'>
              <div className='text-muted-foreground text-sm'>{t('timeSoFar')}</div>
              <div className='text-2xl font-bold tabular-nums'>
                {money(estimate.amount)}
              </div>
              <div className='text-muted-foreground text-xs tabular-nums'>
                {hoursLabel}
              </div>
            </div>
          )}
        </div>

        <SessionMembers session={session} />

        {/* Switching mode is the common ask; ending is the last one */}
        <div className='flex items-center gap-2'>
          <PlayerModeToggle
            className='min-w-0 flex-1'
            value={currentMode}
            disabled={actions.isBusy}
            onChange={(mode) => {
              if (mode && mode !== currentMode) setPendingMode(mode)
            }}
            rates={
              room
                ? { Single: money(room.singleRate), Multi: money(room.multiRate) }
                : undefined
            }
          />
          <Button
            variant='outline'
            className='h-12 shrink-0 gap-2 px-3'
            disabled={actions.isBusy}
            onClick={() => setConfirmEnd(true)}
          >
            <Square className='size-5' />
            <span className='hidden sm:inline'>{t('endSessionButton')}</span>
          </Button>
        </div>
      </div>

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

      {/* Ending bills the time; the quiet third answer is the session that
          should never have started, which still gets its own confirmation */}
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('endThisSession')}
        description={t('endSessionBilledAt', { hours: hoursLabel })}
        cancelLabel={t('keepPlaying')}
        actionLabel={t('endSessionButton')}
        onAction={() => actions.endSession(sessionId)}
        secondaryLabel={t('cancelSessionButton')}
        onSecondary={() => setConfirmCancel(true)}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('cancelThisSession')}
        description={t('cancelSessionHint')}
        cancelLabel={t('keepIt')}
        actionLabel={t('cancelSessionButton')}
        destructive
        onAction={() => actions.cancelSession(sessionId, true)}
      />
    </>
  )
}
