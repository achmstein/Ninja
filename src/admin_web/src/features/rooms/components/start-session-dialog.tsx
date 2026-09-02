import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Gamepad2, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type RoomViewModel } from '@/api/spaces'
import { startWalkInSessionMutation } from '@/api/spaces/@tanstack/react-query.gen'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLocalized, useT } from '@/lib/i18n'
import { PlayerModeToggle, type PlayerMode } from './player-mode-toggle'

interface StartSessionDialogProps {
  room: RoomViewModel | null
  onOpenChange: (open: boolean) => void
}

export function StartSessionDialog({
  room,
  onOpenChange,
}: StartSessionDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [playerMode, setPlayerMode] = useState<PlayerMode>('Single')

  const startWalkIn = useMutation({
    ...startWalkInSessionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getActiveSessions' }],
      })
      toast.success(t('sessionStartedFor', { name: localized(room?.name) }))
      setNotes('')
      setPlayerMode('Single')
      onOpenChange(false)
    },
    onError: () => toast.error(t('failedToStartSession')),
  })

  if (!room) return null

  return (
    <Dialog open={!!room} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[400px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Gamepad2 className='h-5 w-5' />
            {t('startWalkInSession')}
          </DialogTitle>
          <DialogDescription>
            {t('startWalkInDescription', { name: localized(room.name) })}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='bg-muted rounded-lg p-4 text-center'>
            <h3 className='text-lg font-semibold'>{localized(room.name)}</h3>
            <p className='text-primary text-2xl font-bold tabular-nums'>
              {Number(room.singleRate ?? 0)} / {Number(room.multiRate ?? 0)}{' '}
              <span className='text-muted-foreground text-sm font-normal'>
                {t('currency')}{t('perHour')}
              </span>
            </p>
          </div>

          <div className='space-y-2'>
            <Label>{t('playerMode')}</Label>
            <PlayerModeToggle
              value={playerMode}
              onChange={(mode) => mode && setPlayerMode(mode)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>{t('notesOptional')}</Label>
            <Textarea
              id='notes'
              placeholder={t('sessionNotesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
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
            onClick={() =>
              startWalkIn.mutate({
                path: { roomId: Number(room.id) },
                body: { notes: notes || null, playerMode },
              })
            }
            disabled={startWalkIn.isPending}
          >
            {startWalkIn.isPending && (
              <Loader2 className='me-2 h-4 w-4 animate-spin' />
            )}
            {t('startSession')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
