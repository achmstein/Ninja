import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Printer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NumericKeypad } from '@/components/numeric-keypad'
import { BASE_TENDERS } from '@/features/ticket/tenders'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import type { CardCustomer } from './customer-card'
import { TabPaymentSheet, type TabPaymentSlip } from './tab-payment-sheet'
import { usePayTab } from './use-customer-card'

type PayTabDialogProps = {
  customer: CardCustomer
  /** What the customer owes right now — the default amount and the cap. */
  balance: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Take money against a customer's tab: cash into the drawer, card or
 * InstaPay to the terminal. The whole balance is prefilled — the common
 * case is "I'll pay it all" — and the amount cannot exceed it: a tab is
 * paid down, never overpaid into credit from the till. Sales numbers the
 * slip and stamps it with the open shift; Accounts lowers the balance off
 * the event, so the "new balance" shown here is what it will read next.
 */
export function PayTabDialog({ customer, balance, open, onOpenChange }: PayTabDialogProps) {
  const t = useT()
  const money = useMoney()
  const [tender, setTender] = useState(BASE_TENDERS[0])
  const [amountStr, setAmountStr] = useState('')
  const [slip, setSlip] = useState<TabPaymentSlip | null>(null)
  // One request id per open: a retry on café Wi-Fi must not take the money twice
  const requestId = useRef(crypto.randomUUID())

  useEffect(() => {
    if (open) {
      setTender(BASE_TENDERS[0])
      setAmountStr(balance > 0 ? String(balance) : '')
      setSlip(null)
      requestId.current = crypto.randomUUID()
    }
    // The balance is fixed for the life of one open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const entered = Number(amountStr || '0')
  const amount = Number.isFinite(entered) ? Math.min(entered, balance) : 0
  const overBalance = Number.isFinite(entered) && entered > balance

  const pay = usePayTab(customer.id)

  const confirm = () => {
    if (amount <= 0 || pay.isPending) return
    pay.mutate(
      {
        headers: { 'x-requestid': requestId.current },
        query: { 'api-version': API_VERSION },
        body: {
          customerId: customer.id,
          customerName: customer.name || null,
          tender: tender.value,
          amount,
        },
      },
      {
        onSuccess: (data) => {
          const number = toNumber(data.number)
          // Number 0: the first attempt already went through, and the
          // money is on the ledger — nothing more to show than the balance
          setSlip({
            number,
            customerName: customer.name,
            tender: tender.name,
            amount,
            balanceBefore: balance,
            balanceAfter: balance - amount,
            at: new Date(),
          })
          // A fresh id for whatever the cashier records next
          requestId.current = crypto.randomUUID()
        },
        onError: () => toast.error(t('failedToPayTab')),
      }
    )
  }

  // ----- recorded view -----
  if (slip) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='gap-5 sm:max-w-md'>
          <div className='flex flex-col items-center gap-3 py-4 text-center'>
            <CheckCircle2 className='size-14 text-emerald-500' />
            <DialogTitle className='text-2xl'>{t('tabPaymentRecorded')}</DialogTitle>
            {slip.number > 0 && (
              <div className='text-xl font-semibold tabular-nums'>
                {t('tabPaymentNumber', { number: slip.number })}
              </div>
            )}
            <div className='bg-accent w-full rounded-xl p-4'>
              <div className='text-muted-foreground text-sm'>{t('newBalance')}</div>
              <div className='text-4xl font-bold tabular-nums'>
                {money(Math.max(0, slip.balanceAfter))}
              </div>
            </div>
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
            <Button size='lg' className='h-14 text-base' onClick={() => window.print()}>
              <Printer className='size-5' />
              {t('print')}
            </Button>
          </div>
          <TabPaymentSheet slip={slip} />
        </DialogContent>
      </Dialog>
    )
  }

  // ----- entry view -----
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-0 overflow-y-auto p-0 sm:max-w-md'>
        {/* The name on its own line: a long one must not squeeze the amount */}
        <DialogHeader className='border-b px-5 py-3 pe-14'>
          <DialogTitle className='flex items-baseline justify-between gap-4 text-lg'>
            <span>{t('payTab')}</span>
            <span className='shrink-0 text-xl font-bold tabular-nums'>
              {t('owesAmount', { amount: money(balance) })}
            </span>
          </DialogTitle>
          <p className='text-muted-foreground truncate text-sm'>
            {customer.name || t('guest')}
          </p>
        </DialogHeader>

        <div className='flex flex-col gap-3 p-4'>
          <div className='grid grid-cols-3 gap-2'>
            {BASE_TENDERS.map((option) => (
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

          <div
            dir='ltr'
            className='bg-muted flex h-14 items-center justify-end rounded-lg px-4 text-3xl font-bold tabular-nums'
          >
            {amountStr || '0'}
          </div>
          {overBalance && (
            <p className='text-muted-foreground text-sm'>
              {t('cappedAtBalance', { amount: money(balance) })}
            </p>
          )}

          <NumericKeypad value={amountStr} onChange={setAmountStr} />

          <Button
            size='lg'
            className='h-14 justify-between px-5 text-lg'
            disabled={amount <= 0 || pay.isPending}
            onClick={confirm}
          >
            <span>{t('confirmTabPayment')}</span>
            <span className='tabular-nums'>{money(amount)}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
