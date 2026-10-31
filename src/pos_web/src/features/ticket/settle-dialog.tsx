import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CloudOff,
  Loader2,
  Plus,
  Printer,
  Smartphone,
  X,
} from 'lucide-react'
import {
  assignTicketLinesCustomerMutation,
  settleTicketMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { OnlinePaymentView, TicketDetail } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import { NumericKeypad } from '@/components/numeric-keypad'
import { invalidateCustomer, useTab } from '@/features/customer/use-customer-card'
import type { OfflinePayment } from '@/features/offline/offline-replay'
import { type ReceiptPayment } from '@/features/receipt/receipt-sheet'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import {
  openCashDrawer,
  printSheets,
  takesCash,
} from '@/features/printing/print-sheets'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
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
  /** Taken offline: the till's own number, the real one comes on replay */
  provisionalNumber?: string
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
  /** Names the bill in the header: the place, or the bill's label */
  title?: string
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
  onSettled?: (outcome: SettleOutcome) => void
  /**
   * A counter sale the server cannot be reached for: the money is taken
   * here all the same (cash, card or InstaPay, never a tab), and `settle`
   * queues it and answers with the provisional receipt number it printed
   */
  offline?: {
    settle: (payments: OfflinePayment[], change: number) => Promise<string>
  }
}

/**
 * Take one or more payments against the ticket total, then settle: a page of
 * its own over the bill, framed as the bill is (the header across the top,
 * the money and the Settle across the foot), with what is being paid beside
 * how it is paid on a wide screen. The keypad is the only way to type
 * amounts (no OS keyboard on the till).
 * When cash exceeds the remainder, the change due is shown live; the
 * server recomputes it authoritatively on settle.
 */
export function SettleDialog({
  ticket,
  title,
  onlinePayments,
  members,
  open,
  onOpenChange,
  onSettled,
  offline,
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
    !offline && features.tabs && accountHolders.length > 0
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

  // The payments a settle went out with: the exact-cash shortcut sends its
  // own before the list on screen has caught up
  const sentRef = useRef<PendingPayment[]>([])
  const settle = useMutation({
    ...settleTicketMutation(),
    onSuccess: (data, variables) => {
      const sent = sentRef.current
      const outcome: SettleOutcome = {
        receiptNumber: toNumber(data.receiptNumber),
        change: toNumber(data.change),
        payments: [
          ...(variables.body?.payments ?? []).map((p, i) => ({
            tender: sent[i]?.tenderName ?? 'Cash',
            amount: toNumber(p.amount),
            customerName: sent[i]?.customerName,
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
      onSettled?.(outcome)
      // Cash opens the drawer though the receipt waits for Print: the
      // cashier needs to make change (pos_app's _openDrawerForCash)
      if (takesCash(sent.map((p) => ({ tender: p.tenderValue })))) {
        void openCashDrawer()
      }
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      // The drawer's expected cash and the shift's sales just moved
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      // Whatever went on a tab changed what its holder owes
      for (const p of sent) {
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

  const [savingOffline, setSavingOffline] = useState(false)
  const canSettle =
    canSettleWith(online, paid, payments.length) &&
    !settle.isPending &&
    !savingOffline

  // A retry on business Wi-Fi must not become a second command: the same
  // payments keep the same request id until the dialog closes
  const requestIdRef = useRef<{ signature: string; id: string } | null>(null)
  useEffect(() => {
    if (!open) requestIdRef.current = null
  }, [open])

  const settleOffline = async (list: PendingPayment[], change: number) => {
    if (!offline) return
    setSavingOffline(true)
    try {
      const number = await offline.settle(
        list.map((p) => ({
          tender: p.tenderValue,
          tenderName: p.tenderName,
          amount: p.amount,
        })),
        change,
      )
      setResult({
        receiptNumber: 0,
        provisionalNumber: number,
        change,
        accountAmount: 0,
      })
    } catch {
      toast.error(t('offlineSaveFailed'))
    } finally {
      setSavingOffline(false)
    }
  }

  const doSettle = (list = payments) => {
    sentRef.current = list
    if (offline) {
      const paidNow = list.reduce((sum, p) => sum + p.amount, 0)
      void settleOffline(list, Math.max(0, +(paidNow - due).toFixed(2)))
      return
    }
    const signature = JSON.stringify(
      list.map((p) => [p.tenderValue, p.amount, p.customerId ?? null])
    )
    if (requestIdRef.current?.signature !== signature) {
      requestIdRef.current = { signature, id: crypto.randomUUID() }
    }
    settle.mutate({
      headers: { 'x-requestid': requestIdRef.current.id },
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
      body: {
        payments: list.map((p) => ({
          tender: p.tenderValue,
          amount: p.amount,
          customerId: p.customerId ?? null,
          customerName: p.customerName ?? null,
        })),
      },
    })
  }

  const tenderLabel = (name: TenderName) => t(tenderLabelKey[name] ?? 'cash')
  const busy = settle.isPending || savingOffline

  // The one-cash-payment happy path in one tap: what is still owed, in cash,
  // and settled
  const cash = tenders.find((option) => option.name === 'Cash')
  const offersExactCash = payments.length === 0 && remaining > 0 && !!cash && !online.pending
  const exactCash = () => {
    if (!cash || remaining <= 0 || busy) return
    const list: PendingPayment[] = [
      { tenderValue: cash.value, tenderName: cash.name, amount: remaining },
    ]
    setPayments(list)
    doSettle(list)
  }

  const header = (
    <div className='flex h-16 shrink-0 items-center gap-2 border-b px-3'>
      <Button
        variant='ghost'
        size='icon'
        className='size-12'
        aria-label={t('goBack')}
        // Not while the money is on its way: the settle finishes first
        disabled={busy}
        onClick={() => onOpenChange(false)}
      >
        {result ? <X className='size-6' /> : <ArrowLeft className='size-6 rtl:rotate-180' />}
      </Button>
      <DialogPrimitive.Title className='min-w-0 flex-1 truncate text-xl font-bold'>
        {t('settleTitle')}
        {title && (
          <span className='text-muted-foreground font-normal'> · {title}</span>
        )}
      </DialogPrimitive.Title>
      <span className='text-xl font-bold tabular-nums'>{money(total)}</span>
    </div>
  )

  // ----- settled view -----
  const settled = result && (
    <div className='flex flex-1 items-center justify-center overflow-y-auto p-6'>
      <div className='flex w-full max-w-md flex-col items-center gap-3 text-center'>
        <CheckCircle2 className='size-14 text-emerald-500' />
        <div className='text-2xl font-semibold'>{t('ticketSettled')}</div>
        <div className='text-3xl font-bold tabular-nums'>
          {t('receiptNumber', {
            number: result.provisionalNumber ?? result.receiptNumber,
          })}
        </div>
        {result.provisionalNumber && (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <CloudOff className='size-4' />
            {t('offlineSettledHint')}
          </div>
        )}
        {result.change > 0 && (
          <div className='bg-accent w-full rounded-xl p-4'>
            <div className='text-muted-foreground text-sm'>{t('changeDue')}</div>
            <div className='text-4xl font-bold tabular-nums'>{money(result.change)}</div>
          </div>
        )}
        {result.accountAmount > 0 && (
          <div className='bg-accent w-full rounded-xl p-4'>
            <div className='text-muted-foreground text-sm'>{t('onCustomerTab')}</div>
            <div className='text-3xl font-bold tabular-nums'>{money(result.accountAmount)}</div>
          </div>
        )}
        <div className='mt-2 grid w-full grid-cols-2 gap-2'>
          <Button variant='outline' className='h-14 text-base' onClick={() => onOpenChange(false)}>
            {t('done')}
          </Button>
          <Button className='h-14 text-base' onClick={() => void printSheets()}>
            <Printer className='size-5' />
            {t('print')}
          </Button>
        </div>
      </div>
    </div>
  )

  // ----- how it is paid: the tender, whose tab, the amount, the keypad -----
  const howPaid = (
    <div className='flex flex-col gap-3'>
      <div className={cn('grid gap-2', tenders.length === 4 ? 'grid-cols-2' : 'grid-cols-3')}>
        {tenders.map((option) => (
          <Button
            key={option.value}
            variant={tender.value === option.value ? 'default' : 'outline'}
            className='h-12 text-base'
            onClick={() => pickTender(option)}
          >
            {t(option.labelKey)}
          </Button>
        ))}
      </div>

      {/* Whose tab. Always in view, even when there is only one person to
          choose: a charge must never land on a tab nobody saw. */}
      {tender.name === 'Account' && (
        <div className='grid gap-2'>
          <p className='text-muted-foreground text-sm'>{t('whoseAccount')}</p>
          {accountHolders.map((holder) => (
            <HolderButton
              key={holder.id}
              holder={holder}
              chosen={chosenHolder?.id === holder.id}
              onChoose={() => chooseHolder(holder)}
            />
          ))}
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
        className='h-12 text-base'
        disabled={busy || !Number.isFinite(enteredAmount) || enteredAmount <= 0}
        onClick={addPayment}
      >
        <Plus className='size-5' />
        {t('addPayment')}
      </Button>
    </div>
  )

  // ----- what is being paid: the lines, what guests paid online, whose
  // rounds, and the payments taken so far -----
  const whatPaid = (withLines: boolean) => (
    <div className='flex flex-col gap-4'>
      {withLines && (ticket.lines ?? []).length > 0 && (
        <div className='divide-y'>
          {(ticket.lines ?? []).map((line) => (
            <div key={String(line.id)} className='flex items-start gap-3 py-2 text-base'>
              <span className='text-muted-foreground w-10 shrink-0 tabular-nums'>
                {toNumber(line.qty)}×
              </span>
              <span className='min-w-0 flex-1'>
                <span className='line-clamp-2'>{localized(line.description)}</span>
                {line.customerName && (
                  <span className='text-muted-foreground block truncate text-sm'>
                    {line.customerName}
                  </span>
                )}
              </span>
              <span className='shrink-0 tabular-nums'>{money(toNumber(line.total))}</span>
            </div>
          ))}
        </div>
      )}

      {/* Guests paid part of it online: the till takes only what is due */}
      {(online.paid > 0 || online.pending) && (
        <div className='grid gap-1 rounded-lg bg-emerald-500/10 p-3 text-sm'>
          {online.paid > 0 && (
            <div className='flex items-center justify-between gap-4'>
              <span className='flex items-center gap-2'>
                <Smartphone className='size-4' />
                {t('paidOnlineTotal')}
              </span>
              <span className='font-semibold text-emerald-600 tabular-nums dark:text-emerald-400'>
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

      {nudge && (
        <div className='grid gap-2 rounded-lg border p-3'>
          <p className='text-muted-foreground text-sm'>{t('whoseRounds')}</p>
          {unnamed.map((line) => (
            <div key={String(line.id)} className='flex flex-wrap items-center gap-2'>
              <span className='min-w-0 flex-1 truncate text-sm'>
                {localized(line.description)} · {money(toNumber(line.total))}
              </span>
              {accountHolders.map((holder) => (
                <Button
                  key={holder.id}
                  variant='outline'
                  className='h-10'
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

      <div className='grid gap-2'>
        <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
          {t('payments')}
        </h2>
        {payments.length > 0 ? (
          payments.map((payment, index) => (
            <div
              key={index}
              className='bg-accent/50 flex min-h-12 items-center justify-between gap-2 rounded-lg ps-3 pe-1'
            >
              <span className='min-w-0 flex-1 truncate text-base'>
                {tenderLabel(payment.tenderName)}
                {payment.customerName && ` · ${payment.customerName}`}
              </span>
              <span className='font-semibold whitespace-nowrap tabular-nums'>
                {money(payment.amount)}
              </span>
              <Button
                variant='ghost'
                size='icon'
                className='size-10'
                disabled={busy}
                onClick={() => removePayment(index)}
              >
                <X className='size-4' />
              </Button>
            </div>
          ))
        ) : (
          <p className='text-muted-foreground py-3 text-sm'>{t('noPaymentsYet')}</p>
        )}
      </div>
    </div>
  )

  // ----- the bar across the foot, as on the bill: what is left (and the
  // change) at the start, Settle at the end, exact cash before it -----
  const foot = (
    <div className='flex shrink-0 items-center gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:flex-col max-sm:items-stretch'>
      <div className='grid min-w-0 flex-1 gap-0.5 text-lg sm:max-w-sm'>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-muted-foreground'>{t('remaining')}</span>
          <span
            className={cn(
              'font-bold tabular-nums transition-colors',
              remaining > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {money(remaining)}
          </span>
        </div>
        {changeDue > 0 && (
          <div className='flex items-center justify-between gap-4'>
            <span className='text-muted-foreground'>{t('changeDue')}</span>
            <span className='font-bold text-emerald-600 tabular-nums dark:text-emerald-400'>
              {money(changeDue)}
            </span>
          </div>
        )}
      </div>
      <div className='flex gap-2 sm:ms-auto'>
        {offersExactCash && (
          <Button
            variant='outline'
            className='h-14 gap-2 px-5 text-base max-sm:min-w-0 max-sm:flex-1'
            disabled={busy}
            onClick={exactCash}
          >
            <Banknote className='size-5' />
            <span className='truncate'>{t('exactCash')}</span>
          </Button>
        )}
        <Button
          className='h-14 min-w-72 gap-2 px-6 text-lg max-sm:min-w-0 max-sm:flex-[2]'
          disabled={!canSettle}
          onClick={() => doSettle()}
        >
          {busy && <Loader2 className='size-5 animate-spin' />}
          <span className='truncate'>{t('settleAction')}</span>
          <span className='tabular-nums'>· {money(due)}</span>
        </Button>
      </div>
    </div>
  )

  return (
    <DialogPrimitive.Root
      open={open}
      // Escape and the way back close it, never while the money is on its way
      onOpenChange={(next) => {
        if (!next && busy) return
        onOpenChange(next)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className='bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 fixed inset-0 z-50 flex flex-col duration-200 outline-none'
        >
          {header}
          {settled || (
            <>
              {/* Wide: what is paid beside how, as the bill's lines sit
                  beside the room's panel. Narrow: how first (the keypad is
                  what the hand is after), then the payments taken */}
              <div className='flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto'>
                <div className='p-4 lg:hidden'>
                  {howPaid}
                  <div className='mt-6'>{whatPaid(false)}</div>
                </div>
                <div className='min-w-0 flex-1 overflow-y-auto p-4 max-lg:hidden'>
                  {whatPaid(true)}
                </div>
                <div className='bg-muted/40 w-[400px] shrink-0 overflow-y-auto border-s p-4 max-lg:hidden xl:w-[440px]'>
                  {howPaid}
                </div>
              </div>
              {foot}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
