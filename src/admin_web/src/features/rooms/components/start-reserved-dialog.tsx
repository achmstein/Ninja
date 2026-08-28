import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Play } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type ReservationViewModel } from '@/api/rooms'
import { startSessionMutation } from '@/api/rooms/@tanstack/react-query.gen'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLocalized, useT } from '@/lib/i18n'
import { PlayerModeToggle, type PlayerMode } from './player-mode-toggle'

interface StartReservedDialogProps {
  session: ReservationViewModel | null
  onOpenChange: (open: boolean) => void
}

/** Starts the timer for a reserved session, asking for the player mode. */
export function StartReservedDialog({
  session,
  onOpenChange,
}: StartReservedDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [playerMode, setPlayerMode] = useState<PlayerMode | null>(null)

  const startSession = useMutation({
    ...startSessionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getActiveSessions' }],
      })
      toast.success(t('sessionStarted'))
      setPlayerMode(null)
      onOpenChange(false)
    },
    onError: () => toast.error(t('failedToStartSession')),
  })

  if (!session) return null

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[380px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Play className='h-5 w-5 rtl:rotate-180' />
            {t('startSession')}
          </DialogTitle>
          <DialogDescription>
            {localized(session.roomName)}
            {session.customerName ? ` — ${session.customerName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2 py-2'>
          <Label>{t('playerModeOptional')}</Label>
          <PlayerModeToggle
            value={playerMode}
            onChange={setPlayerMode}
            allowNone
          />
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            disabled={startSession.isPending}
            onClick={() =>
              startSession.mutate({
                path: { sessionId: Number(session.id) },
                body: { playerMode },
              })
            }
          >
            {startSession.isPending && (
              <Loader2 className='me-2 h-4 w-4 animate-spin' />
            )}
            {t('start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
