import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { takePartPaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { openCashDrawer } from '@/features/printing/print-sheets'
import { BASE_TENDERS } from '@/features/ticket/tenders'
import { API_VERSION } from '@/lib/api-client'
import { handleServerError } from '@/lib/handle-server-error'
import { useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/** What is being paid apart from the rest of the bill: whose it is, which lines, and what it comes to */
export type PartToPay = { name: string | null; lineIds: number[]; amount: number }

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Taking one person's part of a bill, the bill staying open for the rest: what
 * they owe, how they pay it (cash, card or InstaPay; a tab is for the bill's
 * last payment), and for cash what they handed over, with the change. The
 * money is in this shift's drawer from this moment.
 */
export function PartPaymentSheet({
  ticketId,
  title,
  part,
  onOpenChange,
  onTaken,
}: {
  ticketId: number
  /** The bill's own name, said when the part is nobody's by name */
  title: string
  /** The part to pay; null when nothing is being paid */
  part: PartToPay | null
  onOpenChange: (open: boolean) => void
  onTaken: () => void
}) {
  const t = useT()
  const money = useMoney()
  const queryClient = useQueryClient()
  const [tender, setTender] = useState(BASE_TENDERS[0])
  // Cash handed over, when it is more than what is owed: only for the change
  const [received, setReceived] = useState<number | null>(null)
  // One request id per opening: a second press, or a retry on a poor line, takes the money once
  const [requestId, setRequestId] = useState('')
  useEffect(() => {
    if (!part) return
    setTender(BASE_TENDERS[0])
    setReceived(null)
    setRequestId(crypto.randomUUID())
  }, [part])

  const take = useMutation({
    ...takePartPaymentMutation(),
    onError: handleServerError,
    onSuccess: () => {
      if (tender.name === 'Cash') void openCashDrawer()
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      // The drawer's expected cash just moved
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      toast.success(t('partPaymentTaken', { amount: money(part?.amount ?? 0) }))
      onTaken()
    },
  })

  const due = part?.amount ?? 0
  // The exact amount, then the notes a customer is likely to hand over
  const notes = [...new Set([due, ...[50, 100, 200].map((step) => Math.ceil(due / step) * step)])].slice(0, 4)
  const handed = received ?? due
  const change = round2(handed - due)

  return (
    <Dialog open={part !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='type-title'>
            <bdi>{t('partPayTitle', { name: part?.name ?? title })}</bdi>
          </DialogTitle>
        </DialogHeader>

        <div>
          <span className='text-muted-foreground type-detail'>{t('partPayDue')}</span>
          <div className='type-figure'>{money(due)}</div>
        </div>

        {/* The ways of one choice, the same width */}
        <div className='bg-muted grid grid-cols-3 gap-1 rounded-lg p-1' role='radiogroup'>
          {BASE_TENDERS.map((option) => (
            <button
              key={option.name}
              type='button'
              role='radio'
              aria-checked={tender.name === option.name}
              onClick={() => setTender(option)}
              className={cn(
                'h-12 rounded-md text-base font-medium',
                tender.name === option.name ? 'bg-background shadow-sm ring-1 ring-black/5' : 'text-muted-foreground',
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        {tender.name === 'Cash' && (
          <div className='flex flex-col gap-2'>
            <span className='text-muted-foreground type-detail'>{t('partPayReceived')}</span>
            <div className='grid grid-cols-4 gap-2'>
              {notes.map((note) => (
                <Button
                  key={note}
                  variant='outline'
                  className={cn('h-12 px-1 text-base tabular-nums', handed === note && 'border-primary ring-primary ring-1')}
                  onClick={() => setReceived(note)}
                >
                  {note === due ? t('partPayExact') : note}
                </Button>
              ))}
            </div>
            {change > 0 && (
              <p className='type-body'>
                {t('changeDue')}: <span className='font-semibold tabular-nums'>{money(change)}</span>
              </p>
            )}
          </div>
        )}

        <p className='text-muted-foreground type-detail'>{t('partPayHint')}</p>

        <Button
          size='lg'
          className='h-14 w-full text-lg font-semibold'
          disabled={take.isPending || due <= 0}
          onClick={() =>
            part &&
            take.mutate({
              path: { id: ticketId },
              query: { 'api-version': API_VERSION },
              headers: { 'x-requestid': requestId },
              body: {
                payments: [{ tender: tender.value, amount: part.amount }],
                payerName: part.name,
                lineIds: part.lineIds,
              },
            })
          }
        >
          {take.isPending && <Loader2 className='size-5 animate-spin' />}
          {t('partPayTake', { amount: money(due) })}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
