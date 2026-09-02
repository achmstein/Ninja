import { useState } from 'react'
import { DoorOpen, Square, Timer } from 'lucide-react'
import type { ReservationViewModel, RoomViewModel } from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { RoomPanel } from './room-panel'
import {
  elapsedSeconds,
  formatBillingHours,
  formatClock,
  modeLabel,
  sessionBilledHours,
} from './status'
import { useSecondsClock, useSessionActions } from './use-rooms'

/**
 * The running clock on a room ticket. Its time is not on the bill yet — it
 * lands as lines when the session ends — so the bar shows what is
 * accumulating, ends the session from right here, and opens the room's
 * controls for anything more.
 */
export function SessionBar({
  session,
  room,
}: {
  session: ReservationViewModel
  room: RoomViewModel | undefined
}) {
  const t = useT()
  const actions = useSessionActions()
  const now = useSecondsClock(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const sessionId = toNumber(session.id)
  const billed = sessionBilledHours(session)
  const billedLabel = formatBillingHours(billed, t)

  return (
    <>
      <div className='bg-card text-card-foreground flex items-center gap-3 rounded-xl border p-3 shadow-xs'>
        <Timer className='text-muted-foreground size-6 shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='font-mono text-2xl tabular-nums'>
            {formatClock(elapsedSeconds(session, now))}
          </div>
          <div className='text-muted-foreground truncate text-sm'>
            {t('sessionRunning')}
            {session.currentPlayerMode &&
              ` · ${modeLabel(session.currentPlayerMode, t)}`}
            {billed > 0 && ` · ${t('billedSoFar')}: ${billedLabel}`}
          </div>
        </div>
        {room && (
          <Button
            variant='outline'
            className='h-12 gap-2 px-3'
            onClick={() => setPanelOpen(true)}
          >
            <DoorOpen className='size-5' />
            <span className='hidden sm:inline'>{t('room')}</span>
          </Button>
        )}
        <Button
          variant='destructive'
          className='h-12 gap-2 px-3'
          disabled={actions.isBusy}
          onClick={() => setConfirmEnd(true)}
        >
          <Square className='size-5' />
          <span className='hidden sm:inline'>{t('endSessionButton')}</span>
        </Button>
      </div>

      {room && (
        <RoomPanel
          room={panelOpen ? room : null}
          session={session}
          onOpenChange={(open) => {
            if (!open) setPanelOpen(false)
          }}
        />
      )}

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
    </>
  )
}
