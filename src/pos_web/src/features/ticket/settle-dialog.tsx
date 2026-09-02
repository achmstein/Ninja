import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Printer, X } from 'lucide-react'
import { settleTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import type { TicketDetail } from '@/api/sales/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NumericKeypad } from '@/components/numeric-keypad'
import { type ReceiptPayment } from '@/features/receipt/receipt-sheet'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  ACCOUNT_TENDER,
  BASE_TENDERS,
  tenderLabelKey,
  type TenderName,
} from './tenders'

type PendingPayment = {
  tenderValue: number
  tenderName: TenderName
  amount: number
  /** Whose tab an account payment charges. */
  customerId?: string
  customerName?: string
}

/** Someone on this bill with an account, and what their share comes to. */
type AccountHolder = { id: string; name: string; subtotal: number }

export type SettleOutcome = {
  receiptNumber: number
  change: number
  payments: ReceiptPayment[]
}

type SettledView = {
  receiptNumber: number
  change: number
  /** The part that went on the customer's tab (0 when none). */
  accountAmount: number
}

type SettleDialogProps = {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettled: (outcome: SettleOutcome) => void
}

/**
 * Take one or more payments against the ticket total, then settle. The
 * keypad is the only way to type amounts (no OS keyboard on the till).
 * When cash exceeds the remainder, the change due is shown live; the
 * server recomputes it authoritatively on settle.
 */
export function SettleDialog({
  ticket,
  open,
  onOpenChange,
  onSettled,
}: SettleDialogProps) {
  const t = useT()
  const money = useMoney()
  const queryClient = useQueryClient()

  const total = toNumber(ticket.total)

  // Everyone on this bill who has an account, with their share. A shared
  // table can put Ahmed's items on his tab and Sara's on hers, so the tab is
  // chosen per payment rather than fixed to the ticket. A room's time is its
  // owner's line, so a room that only bought time offers its owner's tab
  // too. A name the till was simply told carries no account and cannot be
  // charged.
  const holders = new Map<string, AccountHolder>()
  for (const line of ticket.lines ?? []) {
    if (!line.customerId) continue
    const id = String(line.customerId)
    const holder = holders.get(id)
    if (holder) holder.subtotal += toNumber(line.total)
    else
      holders.set(id, {
        id,
        name: line.customerName ?? '',
        subtotal: toNumber(line.total),
      })
  }
  const accountHolders = [...holders.values()]

  // Settling on account needs a tab to charge (the server enforces it too)
  const tenders =
    accountHolders.length > 0 ? [...BASE_TENDERS, ACCOUNT_TENDER] : BASE_TENDERS

  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [accountHolder, setAccountHolder] = useState<AccountHolder | null>(null)
  const [tender, setTender] = useState(BASE_TENDERS[0])
  const [amountStr, setAmountStr] = useState('')
  const [result, setResult] = useState<SettledView | null>(null)

  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, +(total - paid).toFixed(2))
  const enteredAmount = Number(amountStr || '0')
  // Live preview: committed payments plus whatever is typed right now
  const projectedPaid = paid + (Number.isFinite(enteredAmount) ? enteredAmount : 0)
  const changeDue = Math.max(0, +(projectedPaid - total).toFixed(2))

  // Prefill the exact remainder whenever the dialog opens or a payment
  // lands — the one-cash-payment happy path is: open, add payment, settle.
  useEffect(() => {
    if (open && !result) {
      setAmountStr(remaining > 0 ? String(remaining) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paid])

  useEffect(() => {
    if (!open) {
      setPayments([])
      setAccountHolder(null)
      setTender(BASE_TENDERS[0])
      setAmountStr('')
      setResult(null)
    }
  }, [open])

  const settle = useMutation({
    ...settleTicketMutation(),
    onSuccess: (data, variables) => {
      const outcome: SettleOutcome = {
        receiptNumber: toNumber(data.receiptNumber),
        change: toNumber(data.change),
        payments: (variables.body?.payments ?? []).map((p, i) => ({
          tender: payments[i]?.tenderName ?? 'Cash',
          amount: toNumber(p.amount),
          customerName: payments[i]?.customerName,
        })),
      }
      setResult({
        receiptNumber: outcome.receiptNumber,
        change: outcome.change,
        accountAmount: outcome.payments
          .filter((p) => p.tender === 'Account')
          .reduce((sum, p) => sum + p.amount, 0),
      })
      onSettled(outcome)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
    },
  })

  // One account holder needs no choosing
  const chosenHolder =
    accountHolder ?? (accountHolders.length === 1 ? accountHolders[0] : null)

  // Tapping a person prefills their share, capped at what is still owed —
  // the common case is "Ahmed's items go on Ahmed's tab"
  const chooseHolder = (holder: AccountHolder) => {
    setAccountHolder(holder)
    const share = holder.subtotal > 0 ? Math.min(holder.subtotal, remaining) : remaining
    setAmountStr(share > 0 ? String(+share.toFixed(2)) : '')
  }

  const addPayment = () => {
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) return
    // An account payment has to name the tab it charges
    if (tender.name === 'Account' && !chosenHolder) return
    // Cash may exceed the remainder (change is given back); card, InstaPay
    // and account cannot — clamp them to what is actually owed (nobody gets
    // cash back out of their account tab).
    const amount =
      tender.name === 'Cash'
        ? enteredAmount
        : Math.min(enteredAmount, remaining)
    if (amount <= 0) return
    setPayments((prev) => [
      ...prev,
      {
        tenderValue: tender.value,
        tenderName: tender.name,
        amount,
        customerId: tender.name === 'Account' ? chosenHolder?.id : undefined,
        customerName: tender.name === 'Account' ? chosenHolder?.name : undefined,
      },
    ])
    setAmountStr('')
    setAccountHolder(null)
  }

  const removePayment = (index: number) =>
    setPayments((prev) => prev.filter((_, i) => i !== index))

  const canSettle = payments.length > 0 && remaining <= 0 && !settle.isPending

  const doSettle = () =>
    settle.mutate({
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
      body: {
        payments: payments.map((p) => ({
          tender: p.tenderValue,
          amount: p.amount,
          customerId: p.customerId ?? null,
          customerName: p.customerName ?? null,
        })),
      },
    })

  const tenderLabel = (name: TenderName) => t(tenderLabelKey[name] ?? 'cash')

  // ----- settled view -----
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='gap-5 sm:max-w-md'>
          <div className='flex flex-col items-center gap-3 py-4 text-center'>
            <CheckCircle2 className='size-14 text-emerald-500' />
            <DialogTitle className='text-2xl'>{t('ticketSettled')}</DialogTitle>
            <div className='text-3xl font-bold tabular-nums'>
              {t('receiptNumber', { number: result.receiptNumber })}
            </div>
            {result.change > 0 && (
              <div className='bg-accent w-full rounded-xl p-4'>
                <div className='text-muted-foreground text-sm'>
                  {t('changeDue')}
                </div>
                <div className='text-4xl font-bold tabular-nums'>
                  {money(result.change)}
                </div>
              </div>
            )}
            {result.accountAmount > 0 && (
              <div className='bg-accent w-full rounded-xl p-4'>
                <div className='text-muted-foreground text-sm'>
                  {t('onCustomerTab')}
                </div>
                <div className='text-3xl font-bold tabular-nums'>
                  {money(result.accountAmount)}
                </div>
              </div>
            )}
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              variant='outline'
              size='lg'
              className='h-14 text-base'
              onClick={() => onOpenChange(false)}
            >
              {t('done')}
            </Button>
            <Button
              size='lg'
              className='h-14 text-base'
              onClick={() => window.print()}
            >
              <Printer className='size-5' />
              {t('print')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ----- payment entry view -----
  // Two columns from the sm breakpoint: how much and how on the start side
  // (tender, amount, keypad), what has been taken and what is left on the
  // end side — so the whole modal fits a tablet in landscape without a
  // scrollbar. On a phone it stacks in the same order it always did.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-0 overflow-y-auto p-0 sm:max-w-2xl'>
        {/* Padded at the end so the total stops short of the close icon */}
        <DialogHeader className='border-b px-5 py-3 pe-14'>
          <DialogTitle className='flex items-baseline justify-between gap-4 text-lg'>
            <span>{t('settleTitle')}</span>
            <span className='text-xl font-bold tabular-nums'>{money(total)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-4 p-4 sm:grid-cols-2'>
          <div className='flex flex-col gap-3'>
            <div
              className={cn(
                'grid gap-2',
                tenders.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
              )}
            >
              {tenders.map((option) => (
                <Button
                  key={option.value}
                  variant={tender.value === option.value ? 'default' : 'outline'}
                  className='h-11 text-base'
                  onClick={() => setTender(option)}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>

            {/* Whose tab. Skipped when only one person on the bill has an
                account — there is nothing to choose. */}
            {tender.name === 'Account' && accountHolders.length > 1 && (
              <div className='grid gap-2'>
                <p className='text-muted-foreground text-sm'>{t('whoseAccount')}</p>
                <div className='grid gap-2'>
                  {accountHolders.map((holder) => (
                    <Button
                      key={holder.id}
                      variant={
                        chosenHolder?.id === holder.id ? 'default' : 'outline'
                      }
                      className='h-11 justify-between px-3 text-base'
                      onClick={() => chooseHolder(holder)}
                    >
                      <span className='truncate'>{holder.name}</span>
                      {holder.subtotal > 0 && (
                        <span className='tabular-nums'>
                          {money(holder.subtotal)}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div
              dir='ltr'
              className='bg-muted flex h-14 items-center justify-end rounded-lg px-4 text-3xl font-bold tabular-nums'
            >
              {amountStr || '0'}
            </div>

            <NumericKeypad value={amountStr} onChange={setAmountStr} />

            <Button
              variant='secondary'
              size='lg'
              className='h-12 text-base'
              disabled={!Number.isFinite(enteredAmount) || enteredAmount <= 0}
              onClick={addPayment}
            >
              {t('addPayment')}
            </Button>
          </div>

          <div className='flex flex-col gap-3'>
            {payments.length > 0 ? (
              <div className='grid gap-2'>
                {payments.map((payment, index) => (
                  <div
                    key={index}
                    className='bg-accent/50 flex items-center justify-between rounded-lg px-3 py-2'
                  >
                    <Badge variant='secondary'>
                      {tenderLabel(payment.tenderName)}
                      {payment.customerName && ` · ${payment.customerName}`}
                    </Badge>
                    <div className='flex items-center gap-1'>
                      <span className='font-semibold tabular-nums'>
                        {money(payment.amount)}
                      </span>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-10'
                        onClick={() => removePayment(index)}
                      >
                        <X className='size-4' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground hidden py-6 text-center text-sm sm:block'>
                {t('noPaymentsYet')}
              </p>
            )}

            <div className='mt-auto grid gap-1 text-lg'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>{t('remaining')}</span>
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    remaining > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {money(remaining)}
                </span>
              </div>
              {changeDue > 0 && (
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>{t('changeDue')}</span>
                  <span className='font-bold tabular-nums text-emerald-600 dark:text-emerald-400'>
                    {money(changeDue)}
                  </span>
                </div>
              )}
            </div>

            <Button
              size='lg'
              className='h-14 w-full text-lg'
              disabled={!canSettle}
              onClick={doSettle}
            >
              {t('confirmSettle')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
