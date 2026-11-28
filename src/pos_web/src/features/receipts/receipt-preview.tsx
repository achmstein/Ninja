import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRealmRoles } from '@/config/oidc-config'
import { Banknote, Check, ChevronDown, Loader2, Minus, Plus, Printer, Undo2, User, X } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import type { TicketDetail } from '@ninja/api/sales'
import { getTicketOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
import { friendlyDay, friendlyTime } from '@/lib/friendly-day'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useTakenByText } from '@/features/branch/use-branch-name'
import { printSheets } from '@/features/printing/print-sheets'
import { ReceiptSheet } from '@/features/receipt/receipt-sheet'
import { ChangeTenderDialog, CORRECTABLE_TENDERS, type TenderFix } from '@/features/ticket/change-tender-dialog'
import { tenderLabelKey } from '@/features/ticket/tenders'
import { useRefund } from '@/features/ticket/use-refund'

const percent = (rate: number | string | undefined) => Math.round(toNumber(rate) * 10000) / 100

/** A quiet name over a part of the receipt */
const label = 'text-muted-foreground type-label pt-4 pb-1'

/**
 * One closed bill, worked on where it is picked: beside the receipts list, or
 * in a sheet over it on a phone. Its head says whose it is and, quietly, its
 * number, when it closed and who closed it. Under the head one band holds the
 * money: what it came to, once, and how it was paid, the way it was paid
 * being a button that puts it right (Cash pressed, InstaPay sent). Then what
 * was on it, and what went back since. Nothing is said twice: no second
 * total, no list of payments repeating the amount. And what is done to a
 * closed bill is done here: it is printed again, and an owner gives money
 * back, the same pane turning to the refund and back.
 */
export function ReceiptPreview({
  ticketId,
  title,
}: {
  ticketId: number
  /** The row's own title: the place, or the delivery's name */
  title: React.ReactNode
}) {
  const t = useT()

  const query = useQuery({
    ...getTicketOptions({ path: { id: ticketId } }),
    // A closed bill changes only by what is done to it here, which refetches it
    staleTime: 60_000,
  })
  const ticket = query.data

  if (query.isError && !ticket) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
        <p className='text-muted-foreground'>{t('receiptLoadFailed')}</p>
        <Button variant='outline' size='lg' onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className='flex flex-1 flex-col gap-4 p-4'>
        <Skeleton className='h-7 w-40' />
        <Skeleton className='h-4 w-56' />
        <div className='space-y-3 pt-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex justify-between gap-4'>
              <Skeleton className='h-4 w-1/2' />
              <Skeleton className='h-4 w-14' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <Receipt ticket={ticket} title={title} />
}

function Receipt({ ticket, title }: { ticket: TicketDetail; title: React.ReactNode }) {
  const t = useT()
  const localized = useLocalized()
  const locale = useLocale()
  const money = useMoney()
  const auth = useAuth()
  const takenByText = useTakenByText()
  const isOwner = getRealmRoles(auth.user).includes('Owner')
  // The pane is the receipt, or the refund being made against it
  const [refunding, setRefunding] = useState(false)
  const [tenderFix, setTenderFix] = useState<TenderFix | null>(null)
  const making = useRefund(ticket, () => setRefunding(false))

  const total = toNumber(ticket.total)
  const subtotal = toNumber(ticket.subtotal)
  const service = toNumber(ticket.serviceCharge)
  const vat = toNumber(ticket.vat)
  const discount = toNumber(ticket.discount)
  const hasBreakdown = discount > 0 || service > 0 || vat > 0
  const payments = ticket.payments ?? []
  const paid = payments.reduce((sum, p) => sum + toNumber(p.amount), 0)
  const change = Math.max(0, paid - total)
  const refunds = ticket.refunds ?? []
  const refunded = toNumber(ticket.refundedTotal)
  const takenBy = takenByText(ticket.takenBy, ticket.takenAtBranchId)
  const isVoided = ticket.status === 'Voided'
  const number = toNumber(ticket.receiptNumber ?? 0)
  const tenderLabel = (tender: string | undefined) => {
    const key = tenderLabelKey[tender ?? '']
    return key ? t(key) : (tender ?? '')
  }
  // The day in words and the time: "Today 1:25 AM", never a full date on every line
  const when = (iso: string | null | undefined) => {
    if (!iso) return ''
    const at = new Date(iso)
    return `${friendlyDay(at, locale, { today: t('today'), yesterday: t('yesterday') })} ${friendlyTime(at, locale)}`
  }

  // What earlier credit notes took of each line, said on the line
  const backByLine = new Map<number, number>()
  for (const refund of refunds) {
    for (const line of refund.lines ?? []) {
      const id = toNumber(line.ticketLineId)
      backByLine.set(id, (backByLine.get(id) ?? 0) + toNumber(line.qty))
    }
  }

  // Owner-only, like a void: money goes back, so an owner says so. Gone once the whole receipt has been credited
  const canRefund = isOwner && !isVoided && ticket.receiptNumber != null && refunded < total
  const leave = () => {
    making.reset()
    setRefunding(false)
  }

  const head = (
    // As tall as the list's head beside it (8 + 48 + 8) while the name fits one line, so the two rules under them meet
    <div className='flex min-h-16 shrink-0 items-center gap-3 border-b px-4 py-2 max-md:pe-14'>
      {refunding ? (
        <>
          <h2 className='type-title min-w-0 flex-1 truncate tabular-nums'>{t('refundTitle', { number })}</h2>
          <Button
            variant='ghost'
            size='icon'
            className='size-12 shrink-0'
            aria-label={t('cancel')}
            disabled={making.pending}
            onClick={leave}
          >
            <X className='size-5' />
          </Button>
        </>
      ) : (
        <div className='min-w-0 flex-1'>
          {/* Whose it is, whole: a long name wraps, it is never cut */}
          <h2 className='type-title break-words'>{title}</h2>
          <p className='text-muted-foreground type-detail tabular-nums'>
            {[
              ticket.receiptNumber != null
                ? t('receiptNumber', { number })
                : t('ticketNumber', { id: toNumber(ticket.id) }),
              when(ticket.settledAt),
              ticket.settledBy,
              takenBy,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}
    </div>
  )

  // The money, once: what it came to, and how it was paid. One payment says only its way; several say who and how much each
  const single = payments.length === 1
  const band = (
    <div className='bg-muted/40 flex shrink-0 items-center gap-4 border-b px-4 py-3 max-sm:flex-col max-sm:items-stretch'>
      <div className='min-w-0 flex-1'>
        <div className='text-muted-foreground type-label'>{t('total')}</div>
        <div className='type-figure'>{money(total)}</div>
        {refunded > 0 && (
          <div className='text-destructive type-detail font-semibold tabular-nums'>
            {t('refundedSoFar')} −{money(refunded)}
          </div>
        )}
      </div>
      {payments.length > 0 && (
        <div className='flex flex-col gap-1.5 sm:min-w-64'>
          {payments.map((payment, i) => {
            // A cash, card or InstaPay payment can be put right, until money has gone back against the bill
            const canFix =
              !isVoided &&
              payment.id != null &&
              refunds.length === 0 &&
              CORRECTABLE_TENDERS.includes(payment.tender ?? '')
            return (
              <div key={String(payment.id ?? i)}>
                <div className='flex items-center gap-3'>
                  <span className='text-muted-foreground type-detail min-w-0 flex-1 truncate'>
                    {single ? t('paidTag') : <bdi>{payment.customerName ?? ''}</bdi>}
                  </span>
                  {!single && <span className='type-body font-semibold tabular-nums'>{money(payment.amount)}</span>}
                  {canFix ? (
                    <Button
                      variant='outline'
                      className='h-11 gap-2 font-semibold'
                      aria-label={`${tenderLabel(payment.tender)}: ${t('changeTender')}`}
                      onClick={() =>
                        setTenderFix({
                          paymentId: toNumber(payment.id),
                          tender: payment.tender ?? '',
                          amount: money(payment.amount),
                        })
                      }
                    >
                      {tenderLabel(payment.tender)}
                      <ChevronDown className='text-muted-foreground size-4' />
                    </Button>
                  ) : (
                    <span className='type-body font-semibold'>{tenderLabel(payment.tender)}</span>
                  )}
                </div>
                {payment.tenderChangedFrom && (
                  // Who changed it and when is the back office's to read; here, only that it was changed
                  <p
                    className='text-muted-foreground type-caption text-end'
                    title={t('tenderChangedFrom', {
                      from: tenderLabel(payment.tenderChangedFrom),
                      name: payment.tenderChangedBy ?? '',
                      time: when(payment.tenderChangedAt),
                    })}
                  >
                    {t('tenderWas', { from: tenderLabel(payment.tenderChangedFrom) })}
                  </p>
                )}
              </div>
            )
          })}
          {change > 0 && (
            <div className='text-muted-foreground type-detail flex justify-between gap-4 tabular-nums'>
              <span>{t('changeDue')}</span>
              <span>{money(change)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const reading = (
    <>
      <ul className='divide-y border-b'>
        {(ticket.lines ?? []).map((line) => {
          const back = backByLine.get(toNumber(line.id)) ?? 0
          const allBack = back >= toNumber(line.qty)
          return (
            <li key={String(line.id)} className='flex min-h-14 items-center gap-3 py-2'>
              <span
                className={cn(
                  'text-muted-foreground min-w-10 shrink-0 whitespace-nowrap tabular-nums',
                  allBack && 'opacity-50'
                )}
              >
                {toNumber(line.qty)}×
              </span>
              <span className={cn('min-w-0 flex-1', allBack && 'opacity-50')}>
                <span className='type-body block truncate font-medium'>{localized(line.description)}</span>
                {localized(line.details) && (
                  <span className='text-muted-foreground type-detail block truncate'>{localized(line.details)}</span>
                )}
                {line.customerName && (
                  <span className='text-muted-foreground type-detail block truncate'>
                    <bdi>{line.customerName}</bdi>
                  </span>
                )}
                {toNumber(line.discount) > 0 && (
                  <span className='text-muted-foreground type-detail block'>
                    {t('discount')} −{money(line.discount)}
                  </span>
                )}
              </span>
              {back > 0 && (
                <span className='bg-destructive/10 text-destructive type-caption shrink-0 rounded-full px-2 font-semibold tabular-nums'>
                  {t('refundedSoFar')} {back}
                </span>
              )}
              <span className={cn('type-body shrink-0 font-medium tabular-nums', allBack && 'opacity-50')}>
                {money(line.total)}
              </span>
            </li>
          )
        })}
      </ul>

      {/* How the total was made up, only when a discount, service or VAT is in it: the total itself is in the band above */}
      {(hasBreakdown || (vat > 0 && ticket.vatIncluded)) && (
        <dl className='text-muted-foreground type-detail space-y-1 pt-3 tabular-nums'>
          {hasBreakdown && (
            <>
              <Row label={t('subtotal')} value={money(subtotal)} />
              {discount > 0 && <Row label={t('discount')} value={`−${money(discount)}`} />}
              {service > 0 && (
                <Row label={t('serviceCharge', { rate: percent(ticket.serviceChargeRate) })} value={money(service)} />
              )}
              {vat > 0 && !ticket.vatIncluded && (
                <Row label={t('vat', { rate: percent(ticket.vatRate) })} value={money(vat)} />
              )}
            </>
          )}
          {vat > 0 && ticket.vatIncluded && (
            <Row label={t('vatIncluded', { rate: percent(ticket.vatRate) })} value={money(vat)} />
          )}
        </dl>
      )}

      {/* Credit notes: money that went back, each with its reason, behind a red rule */}
      {refunds.map((refund) => (
        <div key={String(refund.id)} className='border-s-destructive bg-destructive/5 mt-4 border-s-[3px] px-3 py-2'>
          <div className='flex items-baseline justify-between gap-4'>
            <span className='type-body min-w-0 font-medium'>
              <span className='tabular-nums'>{t('creditNote', { number: toNumber(refund.number) })}</span>
              {refund.reason && ` · ${refund.reason}`}
            </span>
            <span className='text-destructive type-body shrink-0 font-semibold tabular-nums'>
              −{money(refund.amount)}
            </span>
          </div>
          <p className='text-muted-foreground type-caption tabular-nums'>
            {[
              refund.tender === 'Account' ? t('account') : t('cash'),
              refund.customerName,
              refund.refundedBy,
              when(refund.refundedAt),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ))}
    </>
  )

  const quickReasons = [t('refundReasonWrongOrder'), t('refundReasonUnhappy'), t('refundReasonUnavailable')]
  const refundingBody = (
    <>
      <div className='flex min-h-14 items-center justify-between gap-3'>
        <span className='text-muted-foreground type-body'>{t('refundHint', { amount: money(making.remainder) })}</span>
        <Button
          variant='outline'
          className='h-11'
          disabled={making.everythingPicked || making.lines.length === 0}
          onClick={making.pickEverything}
        >
          {t('refundEverything')}
        </Button>
      </div>
      {making.lines.length === 0 ? (
        <p className='text-muted-foreground py-10 text-center'>{t('nothingLeftToRefund')}</p>
      ) : (
        // Picked as lines are picked on an order: a tap ticks the row, and all that is left of it
        // comes back. A row with more than one shows its count once ticked, to give back fewer
        <ul className='divide-y border-y'>
          {making.lines.map((entry) => {
            const picked = entry.picked > 0
            const several = entry.left > 1 || !Number.isInteger(entry.left)
            return (
              <li key={entry.id} className={cn('flex min-h-16 items-center gap-2', picked && 'bg-accent')}>
                <button
                  type='button'
                  role='checkbox'
                  aria-checked={picked}
                  disabled={making.pending}
                  onClick={() => making.toggle(entry)}
                  className='hover:bg-accent/60 flex min-h-16 min-w-0 flex-1 items-center gap-3 px-2 py-2 text-start'
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border',
                      picked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'
                    )}
                  >
                    {picked && <Check className='size-4' />}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='type-body block truncate font-medium'>{localized(entry.line.description)}</span>
                    <span className='text-muted-foreground type-detail block tabular-nums'>
                      {t('leftToRefund', { count: entry.left })} · {money(entry.line.unitPrice)}
                    </span>
                  </span>
                </button>
                {picked && several && (
                  <span className='flex shrink-0 items-center gap-1 pe-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      className='size-11 rounded-full'
                      disabled={making.pending}
                      aria-label={t('decrease')}
                      onClick={() => making.step(entry, -1)}
                    >
                      <Minus className='size-4' />
                    </Button>
                    <span className='type-body w-10 text-center font-semibold tabular-nums'>{entry.picked}</span>
                    <Button
                      variant='outline'
                      size='icon'
                      className='size-11 rounded-full'
                      disabled={making.pending || entry.picked >= entry.left}
                      aria-label={t('increase')}
                      onClick={() => making.step(entry, 1)}
                    >
                      <Plus className='size-4' />
                    </Button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Why: mandatory, it is the audit trail. The usual ones are a tap; any other is typed */}
      <h3 className={label}>{t('reason')}</h3>
      <div className='flex flex-wrap gap-2'>
        {quickReasons.map((why) => (
          <Button
            key={why}
            variant={making.reason === why ? 'default' : 'outline'}
            className='h-11'
            onClick={() => making.setReason(why)}
          >
            {why}
          </Button>
        ))}
      </div>
      <Input
        value={making.reason}
        onChange={(e) => making.setReason(e.target.value)}
        placeholder={t('refundReasonOther')}
        className='mt-2 h-12 text-base'
        autoComplete='off'
      />

      {/* Where the money goes back: the drawer, or a tab that paid */}
      <h3 className={label}>{t('refundGoesTo')}</h3>
      <div className={cn('grid gap-2', making.offerAccount && 'grid-cols-2')}>
        <Button
          variant={making.tender === 'Cash' ? 'default' : 'outline'}
          className='h-12 text-base'
          onClick={() => making.setTender('Cash')}
        >
          <Banknote className='size-5' />
          {t('cash')}
        </Button>
        {making.offerAccount && (
          <Button
            variant={making.tender === 'Account' ? 'default' : 'outline'}
            className='h-12 text-base'
            disabled={making.holders.length === 0}
            onClick={() => making.setTender('Account')}
          >
            <User className='size-5' />
            {t('account')}
          </Button>
        )}
      </div>
      {making.tender === 'Account' && making.holders.length > 1 && (
        <div className='mt-2 flex flex-wrap gap-2'>
          {making.holders.map((h) => (
            <Button
              key={h.id}
              variant={making.holder?.id === h.id ? 'default' : 'outline'}
              className='h-11'
              onClick={() => making.setHolderId(h.id)}
            >
              {h.name || h.id}
            </Button>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {head}
      {!refunding && band}
      {/* Across the whole width the pane is given: a receipt held to a column left the rest of a wide screen empty */}
      <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4'>{refunding ? refundingBody : reading}</div>

      {/* The foot, as on the order: what can be done, in the same place on every receipt */}
      <div className='flex shrink-0 items-center gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:flex-col max-sm:items-stretch'>
        {refunding ? (
          <>
            <Button
              variant='outline'
              size='lg'
              className='h-14 min-w-32 text-base'
              disabled={making.pending}
              onClick={leave}
            >
              {t('goBack')}
            </Button>
            <Button
              variant='destructive'
              size='lg'
              className='h-14 min-w-72 justify-between gap-4 px-6 text-lg font-semibold max-sm:min-w-0 sm:ms-auto'
              disabled={!making.canRefund}
              onClick={making.submit}
            >
              <span className='flex items-center gap-2'>
                {making.pending && <Loader2 className='size-5 animate-spin' />}
                {t('refundTicket')}
              </span>
              <span className='tabular-nums'>{money(making.preview)}</span>
            </Button>
          </>
        ) : (
          <>
            {!isVoided && (
              <Button
                variant='outline'
                size='lg'
                className='h-12 min-w-40 text-base'
                onClick={() => void printSheets()}
              >
                <Printer className='size-5' />
                {t('print')}
              </Button>
            )}
            {canRefund && (
              <Button
                variant='outline'
                size='lg'
                className='text-destructive hover:text-destructive h-12 min-w-40 text-base sm:ms-auto'
                onClick={() => setRefunding(true)}
              >
                <Undo2 className='size-5' />
                {t('refundTicket')}
              </Button>
            )}
          </>
        )}
      </div>

      {/* What Print puts on paper: off screen until then (styles/index.css) */}
      {!isVoided && <ReceiptSheet ticket={ticket} />}
      <ChangeTenderDialog
        ticketId={toNumber(ticket.id)}
        payment={tenderFix}
        onOpenChange={(open) => !open && setTenderFix(null)}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between gap-4'>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
