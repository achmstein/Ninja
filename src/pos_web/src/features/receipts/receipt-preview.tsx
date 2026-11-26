import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ExternalLink, Printer } from 'lucide-react'
import { getTicketOptions } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { printSheets } from '@/features/printing/print-sheets'
import { ReceiptSheet } from '@/features/receipt/receipt-sheet'
import { tenderLabelKey } from '@/features/ticket/tenders'
import { useTakenByText } from '@/features/branch/use-branch-name'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

const percent = (rate: number | string | undefined) =>
  Math.round(toNumber(rate) * 10000) / 100

/**
 * One closed bill, read at a glance beside the receipts list (or in a sheet
 * on a phone): what was on it, what it came to, how it was paid and what
 * went back since. Reprinting is here, since that is most of what a receipt
 * is looked up for; anything that changes the bill (a refund, the way it was
 * paid) is on the bill's own page, one press away.
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
  const localized = useLocalized()
  const locale = useLocale()
  const money = useMoney()
  const takenByText = useTakenByText()

  const query = useQuery({
    ...getTicketOptions({
      path: { id: ticketId },
      query: { 'api-version': API_VERSION },
    }),
    // A closed bill changes only by a refund, made on its own page
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
  const takenBy = takenByText(ticket.takenBy, ticket.takenAtBranchId)
  const isVoided = ticket.status === 'Voided'
  const tenderLabel = (tender: string | undefined) => {
    const key = tenderLabelKey[tender ?? '']
    return key ? t(key) : (tender ?? '')
  }

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        <div className='pe-10'>
          <h2 className='type-title tabular-nums'>
            {ticket.receiptNumber != null
              ? t('receiptNumber', { number: toNumber(ticket.receiptNumber) })
              : t('ticketNumber', { id: toNumber(ticket.id) })}
          </h2>
          <div className='type-body font-medium'>{title}</div>
          <p className='text-muted-foreground type-detail'>
            {ticket.settledAt &&
              new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(ticket.settledAt))}
            {ticket.settledBy && ` · ${t('closedBy')} ${ticket.settledBy}`}
          </p>
          {takenBy && <p className='text-muted-foreground type-detail'>{takenBy}</p>}
        </div>

        <ul className='mt-4 divide-y border-y'>
          {(ticket.lines ?? []).map((line) => (
            <li key={String(line.id)} className='flex items-start gap-3 py-2.5'>
              <span className='text-muted-foreground w-8 shrink-0 tabular-nums'>
                {toNumber(line.qty)}×
              </span>
              <span className='min-w-0 flex-1'>
                <span className='type-body block font-medium'>{localized(line.description)}</span>
                {localized(line.details) && (
                  <span className='text-muted-foreground type-detail block'>
                    {localized(line.details)}
                  </span>
                )}
                {toNumber(line.discount) > 0 && (
                  <span className='text-muted-foreground type-detail block'>
                    {t('discount')} −{money(line.discount)}
                  </span>
                )}
              </span>
              <span className='type-body shrink-0 font-medium tabular-nums'>{money(line.total)}</span>
            </li>
          ))}
        </ul>

        <dl className='mt-3 space-y-1 tabular-nums'>
          {hasBreakdown && (
            <div className='text-muted-foreground space-y-1 type-detail'>
              <Row label={t('subtotal')} value={money(subtotal)} />
              {discount > 0 && <Row label={t('discount')} value={`−${money(discount)}`} />}
              {service > 0 && (
                <Row
                  label={t('serviceCharge', { rate: percent(ticket.serviceChargeRate) })}
                  value={money(service)}
                />
              )}
              {vat > 0 && !ticket.vatIncluded && (
                <Row label={t('vat', { rate: percent(ticket.vatRate) })} value={money(vat)} />
              )}
            </div>
          )}
          <div className='flex justify-between gap-4 text-lg font-bold'>
            <dt>{t('total')}</dt>
            <dd>{money(total)}</dd>
          </div>
          {vat > 0 && ticket.vatIncluded && (
            <div className='text-muted-foreground type-detail'>
              <Row
                label={t('vatIncluded', { rate: percent(ticket.vatRate) })}
                value={money(vat)}
              />
            </div>
          )}
        </dl>

        {payments.length > 0 && (
          <dl className='mt-3 space-y-1 border-t pt-3 tabular-nums'>
            {payments.map((payment) => (
              <Row
                key={String(payment.id)}
                label={
                  payment.customerName
                    ? `${tenderLabel(payment.tender)} · ${payment.customerName}`
                    : tenderLabel(payment.tender)
                }
                value={money(payment.amount)}
              />
            ))}
            {change > 0 && <Row label={t('changeDue')} value={money(change)} />}
          </dl>
        )}

        {refunds.length > 0 && (
          <dl className='mt-3 space-y-2 border-t pt-3 tabular-nums'>
            {refunds.map((refund) => (
              <div key={String(refund.id)}>
                <Row
                  label={t('creditNote', { number: toNumber(refund.number) })}
                  value={`−${money(refund.amount)}`}
                />
                {refund.reason && (
                  <p className='text-muted-foreground type-detail'>{refund.reason}</p>
                )}
              </div>
            ))}
            <div className='flex justify-between gap-4 type-heading'>
              <dt>{t('refundedSoFar')}</dt>
              <dd>−{money(ticket.refundedTotal)}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className='flex shrink-0 gap-2 border-t p-3'>
        {!isVoided && (
          <Button size='lg' className='h-12 flex-1' onClick={() => void printSheets()}>
            <Printer className='size-5' />
            {t('print')}
          </Button>
        )}
        <Button asChild variant='outline' size='lg' className='h-12 flex-1'>
          <Link
            to='/ticket/$ticketId'
            params={{ ticketId: String(ticketId) }}
            search={{ from: 'receipts' }}
          >
            <ExternalLink className='size-5 rtl:-scale-x-100' />
            {t('openReceipt')}
          </Link>
        </Button>
      </div>

      {/* What Print puts on paper: off screen until then (styles/index.css) */}
      {!isVoided && <ReceiptSheet ticket={ticket} />}
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
