import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { voidTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

type VoidTicketDialogProps = {
  ticketId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Owner-only: voids an open ticket. The reason is mandatory — a voided
 * ticket disappears from the floor, and the reason is the only audit
 * trail left behind (the server refuses to void settled tickets).
 */
export function VoidTicketDialog({
  ticketId,
  open,
  onOpenChange,
}: VoidTicketDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) setReason('')
  }, [open])

  const voidTicket = useMutation({
    ...voidTicketMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      toast.success(t('ticketVoided'))
      onOpenChange(false)
      navigate({ to: '/' })
    },
  })

  const canVoid = reason.trim().length > 0 && !voidTicket.isPending

  const doVoid = () =>
    voidTicket.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
      body: { reason: reason.trim() },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('voidTicket')}</DialogTitle>
        </DialogHeader>

        <div className='grid gap-1.5'>
          <Label htmlFor='void-reason'>{t('reason')}</Label>
          <Input
            id='void-reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
          <p className='text-muted-foreground text-sm'>{t('voidReasonHint')}</p>
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
            variant='destructive'
            size='lg'
            className='h-12'
            disabled={!canVoid}
            onClick={doVoid}
          >
            {t('confirmVoid')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
