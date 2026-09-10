import { useEffect, useState } from 'react'
import { Clock, Loader2, Play } from 'lucide-react'
import type { ReservationViewModel, RoomViewModel } from '@/api/spaces/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { PlayerModeToggle } from './player-mode-toggle'
import type { PlayerMode } from './status'
import { useSessionActions } from './use-rooms'

type StartSessionDialogProps = {
  /** The room to start; null keeps the dialog closed. */
  room: RoomViewModel | null
  /** A reservation to start the timer on; without one, a walk-in starts. */
  session?: ReservationViewModel | null
  onOpenChange: (open: boolean) => void
  /** The session started; the caller decides where the till goes next. */
  onStarted?: () => void
}

/**
 * Starts the clock: a walk-in from an available room, or the reserved
 * session of a customer who just arrived. The player mode can wait — the
 * server bills at the single rate until one is chosen.
 */
export function StartSessionDialog({
  room,
  session,
  onOpenChange,
  onStarted,
}: StartSessionDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const actions = useSessionActions()
  const [playerMode, setPlayerMode] = useState<PlayerMode>('Single')

  const open = room != null
  useEffect(() => {
    if (!open) setPlayerMode('Single')
  }, [open])

  // The room panel used to offer Reserve beside Start; a free room now
  // opens this dialog directly, so it lives here for a walk-in
  const reserve = () => {
    if (!room) return
    actions.reserve(toNumber(room.id), null, {
      onSuccess: () => onOpenChange(false),
    })
  }

  const start = () => {
    if (!room) return
    const done = {
      onSuccess: () => {
        onOpenChange(false)
        onStarted?.()
      },
    }
    if (session) actions.startReserved(toNumber(session.id), playerMode, done)
    else actions.startWalkIn(toNumber(room.id), playerMode, done)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-xl'>
            <Play className='size-5 rtl:rotate-180' />
            {session ? t('startSession') : t('startWalkInSession')}
          </DialogTitle>
          <DialogDescription className='text-base'>
            {session
              ? [localized(room?.name), session.customerName]
                  .filter(Boolean)
                  .join(' · ')
              : t('startWalkInDescription', { name: localized(room?.name) })}
          </DialogDescription>
        </DialogHeader>

        {/* The card prices the mode picked below; the toggle carries both
            rates so the other one stays in view */}
        <div className='bg-muted rounded-xl p-4 text-center'>
          <div className='text-lg font-semibold'>{localized(room?.name)}</div>
          <div className='text-primary flex items-baseline justify-center gap-1 text-2xl font-bold tabular-nums'>
            <span>{money(playerMode === 'Multi' ? room?.multiRate : room?.singleRate)}</span>
            <span className='text-muted-foreground text-sm font-normal'>
              {t('perHour')}
            </span>
          </div>
        </div>

        <div className='grid gap-2'>
          <Label>{t('playerMode')}</Label>
          <PlayerModeToggle
            value={playerMode}
            onChange={(mode) => mode && setPlayerMode(mode)}
            rates={{
              Single: money(room?.singleRate),
              Multi: money(room?.multiRate),
            }}
          />
        </div>

        <DialogFooter className='gap-2'>
          {!session && (
            <Button
              variant='outline'
              size='lg'
              className='h-12 sm:me-auto'
              disabled={actions.isBusy}
              onClick={reserve}
            >
              <Clock className='size-5' />
              {t('reserve')}
            </Button>
          )}
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            size='lg'
            className='h-12 px-6'
            disabled={actions.isBusy}
            onClick={start}
          >
            {actions.isBusy ? (
              <Loader2 className='size-5 animate-spin' />
            ) : (
              <Play className='size-5 rtl:rotate-180' />
            )}
            {t('startSession')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
