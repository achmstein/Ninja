import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Printer, Smartphone, X } from 'lucide-react'
import {
  assignTicketLinesCustomerMutation,
  settleTicketMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { OnlinePaymentView, TicketDetail } from '@/api/sales/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NumericKeypad } from '@/components/numeric-keypad'
import { invalidateCustomer, useTab } from '@/features/customer/use-customer-card'
import { type ReceiptPayment } from '@/features/receipt/receipt-sheet'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { canSettleWith, onlineSummary } from './online-payments'
import {
  ACCOUNT_TENDER,
  BASE_TENDERS,
  ONLINE_TENDER,
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

/**
 * One tab the bill can go on: the person, what they already owe (so the
 * cashier is never adding to a tab blind), and their share of this bill.
 */
function HolderButton({
  holder,
  chosen,
  onChoose,
}: {
  holder: AccountHolder
  chosen: boolean
  onChoose: () => void
}) {
  const t = useT()
  const money = useMoney()
  const { tab, noTab, isPending } = useTab(holder.id)
  const owed = toNumber(tab?.balance)

  return (
    <Button
      variant={chosen ? 'default' : 'outline'}
      className='h-auto min-h-11 justify-between px-3 py-2 text-base'
      onClick={onChoose}
    >
      <span className='truncate'>{holder.name || t('guest')}</span>
      <span className='flex shrink-0 flex-col items-end text-sm leading-tight'>
        <span
          className={cn(
            'tabular-nums',
            !chosen && owed > 0 && 'text-destructive'
          )}
        >
          {isPending
            ? '…'
            : noTab
              ? t('noTab')
              : t('owesAmount', { amount: money(Math.max(0, owed)) })}
        </span>
        {holder.subtotal > 0 && (
          <span className='tabular-nums opacity-80'>
            {t('thisBill', { amount: money(holder.subtotal) })}
          </span>
        )}
      </span>
    </Button>
  )
}

type SettleDialogProps = {
  ticket: TicketDetail
  /**
   * What guests paid from their phones. The server adds every paid one to
   * the settle itself, so the till takes only the rest; while one is still
   * at the checkout the bill cannot settle.
   */
  onlinePayments?: OnlinePaymentView[]
  /**
   * The people in the room, for a room ticket: each is a tab the bill can go
   * on, whether or not they ordered anything themselves.
   */
  members?:
    | { customerId?: string | null; customerName?: string | null }[]
    | null
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
  onlinePayments,
  members,
  open,
  onOpenChange,
  onSettled,
}: SettleDialogProps) {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const money = useMoney()
  const queryClient = useQueryClient()

  const total = toNumber(ticket.total)
  // What the till takes: the total less what guests paid online
  const online = onlineSummary(ticket.total, onlinePayments)
  const due = online.remaining

  // Everyone this bill can go on, with their share. The people in the room
  // come first: a group splits the time between them however they agree,
  // and someone who ordered nothing still owes their part. Then whoever
  // has lines, with what those come to. A shared table can put Ahmed's
  // items on his tab and Sara's on hers, so the tab is chosen per payment
  // rather than fixed to the ticket. A name the till was simply told
  // carries no account and cannot be charged.
  const holders = new Map<string, AccountHolder>()
  for (const member of members ?? []) {
    if (!member.customerId) continue
    const id = String(member.customerId)
    holders.set(id, { id, name: member.customerName ?? '', subtotal: 0 })
  }
  for (const line of ticket.lines ?? []) {
    // The room's time is nobody's share: the group splits it as they say
    if (!line.customerId || line.source === 'SessionTime') continue
    const id = String(line.customerId)
    const holder = holders.get(id)
    if (holder) {
      holder.subtotal += toNumber(line.total)
      if (!holder.name && line.customerName) holder.name = line.customerName
    } else {
      holders.set(id, {
        id,
        name: line.customerName ?? '',
        subtotal: toNumber(line.total),
      })
    }
  }
  const accountHolders = [...holders.values()]

  // A round the till named nobody for, on a bill with more than one tab:
  // whose is it? Listed once, a tap names it (the same call as naming lines
  // on the ticket screen), and ignoring it is fine - the bill settles either
  // way. The room's time is nobody's and never asked about.
  const unnamed = (ticket.lines ?? []).filter(
    (line) =>
      !line.customerId &&
      !line.customerName &&
      line.source !== 'SessionTime' &&
      toNumber(line.total) > 0
  )
  const nudge = accountHolders.length > 1 && unnamed.length > 0
  const nameLine = useMutation({
    ...assignTicketLinesCustomerMutation(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] }),
  })
  const nameLineFor = (lineId: number, holder: AccountHolder) =>
    nameLine.mutate({
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
      body: { lineIds: [lineId], customerId: holder.id, customerName: holder.name },
    })

  // Settling on account needs tabs switched on and a tab to charge (the
  // server enforces both)
  const tenders =
    features.tabs && accountHolders.length > 0
      ? [...BASE_TENDERS, ACCOUNT_TENDER]
      : BASE_TENDERS

  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [accountHolder, setAccountHolder] = useState<AccountHolder | null>(null)
  const [tender, setTender] = useState(BASE_TENDERS[0])
  const [amountStr, setAmountStr] = useState('')
  const [result, setResult] = useState<SettledView | null>(null)

  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, +(due - paid).toFixed(2))
  const enteredAmount = Number(amountStr || '0')
  // Live preview: committed payments plus whatever is typed right now
  const projectedPaid = paid + (Number.isFinite(enteredAmount) ? enteredAmount : 0)
  const changeDue = Math.max(0, +(projectedPaid - due).toFixed(2))

  // Prefill the exact remainder whenever the dialog opens or a payment
  // lands — the one-cash-payment happy path is: open, add payment, settle.
  // Never for a tab: what goes on account is typed, share by share.
  useEffect(() => {
    if (open && !result) {
      setAmountStr(
        tender.name !== 'Account' && remaining > 0 ? String(remaining) : ''
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paid, due])

  // Paid online in full while the dialog was open: the bill settled itself
  // on the server, and the ticket screen now shows it closed
  useEffect(() => {
    if (open && !result && ticket.status === 'Settled') onOpenChange(false)
  }, [open, result, ticket.status, onOpenChange])

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
        payments: [
          ...(variables.body?.payments ?? []).map((p, i) => ({
            tender: payments[i]?.tenderName ?? 'Cash',
            amount: toNumber(p.amount),
            customerName: payments[i]?.customerName,
          })),
          // The server added these to the settle; the receipt shows them
          ...(onlinePayments ?? [])
            .filter((p) => p.status === 'Paid')
            .map((p) => ({
              tender: ONLINE_TENDER.name,
              amount: toNumber(p.amount),
            })),
        ],
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
      // Whatever went on a tab changed what its holder owes
      for (const p of payments) {
        if (p.customerId) invalidateCustomer(queryClient, p.customerId)
      }
    },
  })

  // One account holder needs no choosing
  const chosenHolder =
    accountHolder ?? (accountHolders.length === 1 ? accountHolders[0] : null)

  // A person's own items, capped at what is still owed — the common case
  // is "Ahmed's items go on Ahmed's tab". Never the remainder: someone who
  // ordered nothing owes only the part of the time the group says, and
  // that is typed.
  const shareOf = (holder: AccountHolder | null) =>
    holder && holder.subtotal > 0
      ? String(+Math.min(holder.subtotal, remaining).toFixed(2))
      : ''

  const chooseHolder = (holder: AccountHolder) => {
    setAccountHolder(holder)
    setAmountStr(shareOf(holder))
  }

  // Cash, card and InstaPay start from what is still owed; a tab starts
  // from the chosen person's items
  const pickTender = (option: (typeof tenders)[number]) => {
    setTender(option)
    if (option.name !== 'Account') {
      setAmountStr(remaining > 0 ? String(remaining) : '')
      return
    }
    setAmountStr(
      shareOf(
        accountHolder ??
          (accountHolders.length === 1 ? accountHolders[0] : null)
      )
    )
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

  const canSettle =
    canSettleWith(online, paid, payments.length) && !settle.isPending

  const doSettle = () =>
    settle.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
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

        {/* Guests paid part of it online: the till takes only what is due */}
        {(online.paid > 0 || online.pending) && (
          <div className='grid gap-1 border-b px-5 py-2 text-sm'>
            {online.paid > 0 && (
              <div className='flex items-center justify-between gap-4'>
                <span className='text-muted-foreground flex items-center gap-2'>
                  <Smartphone className='size-4' />
                  {t('paidOnlineTotal')}
                </span>
                <span className='font-semibold tabular-nums'>
                  −{money(online.paid)}
                </span>
              </div>
            )}
            <div className='flex items-center justify-between gap-4 text-base'>
              <span className='font-medium'>{t('amountDue')}</span>
              <span className='font-bold tabular-nums'>{money(due)}</span>
            </div>
            {online.pending && (
              <div className='flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400'>
                <Loader2 className='size-4 animate-spin' />
                {t('guestPayingOnline')}
              </div>
            )}
          </div>
        )}

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
                  onClick={() => pickTender(option)}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>

            {/* Whose tab. Always in view, even when there is only one person
                to choose: a charge must never land on a tab nobody saw. */}
            {tender.name === 'Account' && (
              <div className='grid gap-2'>
                <p className='text-muted-foreground text-sm'>{t('whoseAccount')}</p>
                <div className='grid gap-2'>
                  {accountHolders.map((holder) => (
                    <HolderButton
                      key={holder.id}
                      holder={holder}
                      chosen={chosenHolder?.id === holder.id}
                      onChoose={() => chooseHolder(holder)}
                    />
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
            {nudge && (
              <div className='grid gap-2 rounded-lg border p-3'>
                <p className='text-muted-foreground text-sm'>{t('whoseRounds')}</p>
                {unnamed.map((line) => (
                  <div
                    key={String(line.id)}
                    className='flex flex-wrap items-center gap-2'
                  >
                    <span className='min-w-0 flex-1 truncate text-sm'>
                      {localized(line.description)} · {money(toNumber(line.total))}
                    </span>
                    {accountHolders.map((holder) => (
                      <Button
                        key={holder.id}
                        size='sm'
                        variant='outline'
                        disabled={nameLine.isPending}
                        onClick={() => nameLineFor(toNumber(line.id), holder)}
                      >
                        {holder.name || t('guest')}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {payments.length > 0 ? (
              <div className='grid gap-2'>
                {payments.map((payment, index) => (
                  <div
                    key={index}
                    className='bg-accent/50 flex items-center justify-between gap-2 rounded-lg px-3 py-2'
                  >
                    <Badge
                      variant='secondary'
                      className='min-w-0 max-w-full shrink truncate'
                    >
                      {tenderLabel(payment.tenderName)}
                      {payment.customerName && ` · ${payment.customerName}`}
                    </Badge>
                    <div className='flex shrink-0 items-center gap-1'>
                      <span className='font-semibold whitespace-nowrap tabular-nums'>
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
