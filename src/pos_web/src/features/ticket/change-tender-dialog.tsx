import { useMutation, useQueryClient } from '@tanstack/react-query'
import { changePaymentTenderMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BASE_TENDERS, tenderLabelKey } from './tenders'

/** The payment being put right; null keeps the dialog closed. */
export type TenderFix = {
  paymentId: number
  tender: string
  amount: string
}

type ChangeTenderDialogProps = {
  ticketId: number
  payment: TenderFix | null
  onOpenChange: (open: boolean) => void
}

/** The tenders a paid bill's payment may move between: the drawer's and the terminal's. */
export const CORRECTABLE_TENDERS = ['Cash', 'Card', 'InstaPay']

/**
 * Cash pressed, the customer sent InstaPay: one tap puts the payment right
 * while the shift is still open. The server refuses once the shift is
 * counted or the bill has a refund, and says why.
 */
export function ChangeTenderDialog({ ticketId, payment, onOpenChange }: ChangeTenderDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()

  const change = useMutation({
    ...changePaymentTenderMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      // The drawer's expected cash moves with it
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getSettledTickets' }] })
      toast.success(t('tenderChanged'))
      onOpenChange(false)
    },
  })

  const pick = (tender: string) => {
    if (!payment) return
    change.mutate({
      // A retry on business Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: ticketId, paymentId: payment.paymentId },
      query: { 'api-version': API_VERSION },
      body: { tender },
    })
  }

  const from = payment ? t(tenderLabelKey[payment.tender] ?? 'cash') : ''
  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent size='sm'>
        <DialogHeader>
          <DialogTitle>{t('changeTenderTitle')}</DialogTitle>
          <DialogDescription>
            {t('changeTenderHint', { amount: payment?.amount ?? '', tender: from })}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          {BASE_TENDERS.filter((x) => x.name !== payment?.tender).map((x) => (
            <Button key={x.name} size='lg' variant='outline' disabled={change.isPending} onClick={() => pick(x.name)}>
              {t(x.labelKey)}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
