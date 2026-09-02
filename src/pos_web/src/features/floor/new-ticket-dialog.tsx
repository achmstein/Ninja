import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, ShoppingBag } from 'lucide-react'
import { openTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { TICKET_TYPE_COUNTER } from '@/lib/ticket-types'

type NewTicketDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Opens a counter tab: a bill with no place, named after whoever it is for.
 * Tables open from their own tile on the floor and rooms follow their
 * sessions, so this is the one kind of bill that needs asking about.
 */
export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')

  const openTicket = useMutation({
    ...openTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      onOpenChange(false)
      setLabel('')
      navigate({
        to: '/ticket/$ticketId',
        params: { ticketId: String(result.ticketId) },
      })
    },
  })

  const openCounter = () =>
    openTicket.mutate({
      query: { 'api-version': API_VERSION },
      body: {
        type: TICKET_TYPE_COUNTER,
        label: label.trim() || null,
      },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-5 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('newTab')}</DialogTitle>
          <DialogDescription className='text-base'>
            {t('newTabHint')}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-2'>
          <Label htmlFor='tab-label'>
            {t('tabName')}{' '}
            <span className='text-muted-foreground font-normal'>
              ({t('optional')})
            </span>
          </Label>
          <Input
            id='tab-label'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
            onKeyDown={(e) => {
              if (e.key === 'Enter') openCounter()
            }}
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
            disabled={openTicket.isPending}
            onClick={openCounter}
          >
            {openTicket.isPending ? (
              <Loader2 className='size-5 animate-spin' />
            ) : (
              <ShoppingBag className='size-5' />
            )}
            {t('openTicketAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
