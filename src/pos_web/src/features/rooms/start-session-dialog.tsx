import { useEffect, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
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

  const start = () => {
    if (!room) return
    const done = { onSuccess: () => onOpenChange(false) }
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

        <div className='bg-muted rounded-xl p-4 text-center'>
          <div className='text-lg font-semibold'>{localized(room?.name)}</div>
          <div className='text-primary text-2xl font-bold tabular-nums'>
            {money(room?.singleRate)} · {money(room?.multiRate)}
            <span className='text-muted-foreground ms-1 text-sm font-normal'>
              {t('perHour')}
            </span>
          </div>
        </div>

        <div className='grid gap-2'>
          <Label>{t('playerMode')}</Label>
          <PlayerModeToggle
            value={playerMode}
            onChange={(mode) => mode && setPlayerMode(mode)}
          />
        </div>

        <DialogFooter className='gap-2'>
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
