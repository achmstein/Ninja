import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { takePartPaymentMutation } from '@ninja/api/sales/@tanstack/react-query.gen'
import { handleServerError } from '@/lib/handle-server-error'
import { useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NumericKeypad } from '@/components/numeric-keypad'
import { openCashDrawer } from '@/features/printing/print-sheets'
import { BASE_TENDERS } from '@/features/ticket/tenders'
import { partAmountProblem } from './part-amounts'

/**
 * What is being paid apart from the rest of the bill: whose it is, which lines,
 * and what those come to. No lines and nothing owed is an amount on account of
 * the bill, from someone who had nothing of their own on it.
 */
export type PartToPay = { name: string | null; lineIds: number[]; amount: number }

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Taking one person's part of a bill, the bill staying open for the rest. The
 * customer says what they pay: what they had, as it stands, or any other
 * amount typed in its place, what is over their items going
 * on account of the bill (a player leaving a room pays towards its time, and
 * how much is theirs to say, never the till's to work out). The amount on the
 * sheet is the amount taken; it goes into this shift's drawer at once.
 */
export function PartPaymentSheet({
  ticketId,
  title,
  part,
  left,
  clockRunning,
  onOpenChange,
  onTaken,
}: {
  ticketId: number
  /** The bill's own name, said when the part is nobody's by name */
  title: string
  /** The part to pay; null when nothing is being paid */
  part: PartToPay | null
  /** What is still to pay on the bill as it stands */
  left: number
  /** The room's clock is running: its time is not on the bill yet */
  clockRunning: boolean
  onOpenChange: (open: boolean) => void
  onTaken: () => void
}) {
  const t = useT()
  const money = useMoney()
  const queryClient = useQueryClient()
  const [tender, setTender] = useState(BASE_TENDERS[0])
  // What they pay, as typed; empty is exactly what their items come to
  const [typed, setTyped] = useState('')
  const [keypad, setKeypad] = useState(false)
  // One request id per opening: a second press, or a retry on a poor line, takes the money once
  const [requestId, setRequestId] = useState('')
  const items = part?.amount ?? 0
  const onAccount = !!part && items <= 0
  useEffect(() => {
    if (!part) return
    setTender(BASE_TENDERS[0])
    setTyped('')
    // An amount on account has nothing to start from: the keypad is what the hand is after
    setKeypad(part.amount <= 0)
    setRequestId(crypto.randomUUID())
  }, [part])

  const amount = typed === '' ? items : round2(Number(typed) || 0)
  const extra = round2(amount - items)
  const problem = partAmountProblem(amount, items, left, clockRunning)

  const take = useMutation({
    ...takePartPaymentMutation(),
    onError: handleServerError,
    onSuccess: () => {
      if (tender.name === 'Cash') void openCashDrawer()
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      // The drawer's expected cash just moved
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      toast.success(t('partPaymentTaken', { amount: money(amount) }))
      onTaken()
    },
  })

  return (
    <Dialog open={part !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='type-title'>
            {onAccount ? t('partPayOnAccount') : <bdi>{t('partPayTitle', { name: part?.name ?? title })}</bdi>}
          </DialogTitle>
        </DialogHeader>

        {!onAccount && (
          <div className='type-detail flex items-baseline justify-between'>
            <span className='text-muted-foreground'>{t('partPayItems')}</span>
            <span className='font-medium tabular-nums'>{money(items)}</span>
          </div>
        )}

        <div>
          <span className='text-muted-foreground type-detail'>{t('partPayPays')}</span>
          <div className={cn('type-figure tabular-nums', amount <= 0 && 'text-muted-foreground')}>{money(amount)}</div>
        </div>

        {/* They pay for what they had unless told otherwise: one button opens the keypad
            for any other amount, and the same button goes back to just their items.
            An amount on account has nothing to go back to: its keypad is simply there */}
        {!onAccount && (
          <Button
            variant='outline'
            className='h-12 w-full text-base'
            onClick={() => {
              setKeypad(!keypad)
              setTyped('')
            }}
          >
            {keypad ? t('partPayItemsOnly') : t('partPayOther')}
          </Button>
        )}
        {keypad && <NumericKeypad value={typed} onChange={setTyped} />}

        {/* Said before the tap: what is theirs, and what goes towards the rest of the bill */}
        {problem === 'none' && !onAccount && extra > 0 && (
          <p className='type-detail rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400'>
            {t('partPaySplit', { items: money(items), extra: money(extra) })}
          </p>
        )}
        {problem === 'belowItems' && (
          <p className='text-destructive type-detail'>{t('partPayBelowItems', { items: money(items) })}</p>
        )}
        {problem === 'paysAll' && <p className='text-destructive type-detail'>{t('partPayPaysAll')}</p>}

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
                tender.name === option.name ? 'bg-background shadow-sm ring-1 ring-black/5' : 'text-muted-foreground'
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <p className='text-muted-foreground type-detail'>{t(clockRunning ? 'partPayHintClock' : 'partPayHint')}</p>

        <Button
          size='lg'
          className='h-14 w-full justify-between px-5 text-lg font-semibold'
          disabled={take.isPending || problem !== 'none'}
          onClick={() =>
            part &&
            take.mutate({
              path: { id: ticketId },
              headers: { 'x-requestid': requestId },
              body: {
                payments: [{ tender: tender.value, amount }],
                payerName: part.name,
                lineIds: part.lineIds,
              },
            })
          }
        >
          <span className='flex items-center gap-2'>
            {take.isPending && <Loader2 className='size-5 animate-spin' />}
            {t('partPayTakeWith', { tender: t(tender.labelKey) })}
          </span>
          <span className='tabular-nums'>{money(amount)}</span>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
