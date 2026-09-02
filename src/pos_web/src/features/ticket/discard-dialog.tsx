import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  discardTicketMutation,
  getTicketQueryKey,
} from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

type DiscardTicketDialogProps = {
  ticketId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Throws away an open ticket nothing ever landed on — opened for the wrong
 * table, or for a walk-in who changed their mind at the counter. Unlike a
 * void there is no reason to type and no owner to fetch: the server deletes
 * the row (it refuses once a line exists) and the floor forgets the tile.
 */
export function DiscardTicketDialog({
  ticketId,
  open,
  onOpenChange,
}: DiscardTicketDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const discard = useMutation({
    ...discardTicketMutation(),
    onSuccess: () => {
      onOpenChange(false)
      navigate({ to: '/' })
      // Dropped rather than invalidated: the ticket is gone, so a refetch
      // could only come back 404
      queryClient.removeQueries({
        queryKey: getTicketQueryKey({
          path: { id: ticketId },
          query: { 'api-version': API_VERSION },
        }),
      })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      toast.success(t('ticketDiscarded'))
    },
  })

  const doDiscard = () =>
    discard.mutate({
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('discardTicketTitle')}</DialogTitle>
          <DialogDescription className='text-base'>
            {t('discardTicketHint')}
          </DialogDescription>
        </DialogHeader>

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
            disabled={discard.isPending}
            onClick={doDiscard}
          >
            {t('confirmDiscard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
