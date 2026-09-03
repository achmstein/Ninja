import { useQuery } from '@tanstack/react-query'
import { Ban, User } from 'lucide-react'
import { type TicketLineView } from '@/api/sales'
import { getTicketOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ticketStatusKey, ticketTypeKey } from './tender'
import { TenderBadge } from './tender-badge'
import { ticketTitle } from './ticket-title'

const percent = (rate: number | string | null | undefined) =>
  Math.round(toNumber(rate) * 10000) / 100

type LineGroup = {
  key: string | null
  name: string | null
  lines: TicketLineView[]
  total: number
}

// Lines in arrival order, grouped by whoever they were rung up for. One
// person is one group however they were named: an account holder by their
// account, a guest by the id Ordering gave them, and a name the till was only
// told by the name itself. Unattributed lines stay together under the place.
function groupLines(lines: TicketLineView[]): LineGroup[] {
  return lines.reduce<LineGroup[]>((groups, line) => {
    const key = line.customerId
      ? `account:${line.customerId}`
      : line.guestId
        ? `guest:${line.guestId}`
        : line.customerName
          ? `name:${line.customerName}`
          : null
    const group = groups.find((g) => g.key === key)
    if (group) {
      group.lines.push(line)
      group.total += toNumber(line.total)
      group.name ??= line.customerName || null
    } else {
      groups.push({
        key,
        name: line.customerName || null,
        lines: [line],
        total: toNumber(line.total),
      })
    }
    return groups
  }, [])
}

function LineRow({ line }: { line: TicketLineView }) {
  const t = useT()
  const localized = useLocalized()
  const isNegative = toNumber(line.total) < 0
  const discount = toNumber(line.discount)
  const credit = isNegative && 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className='flex items-start gap-3 py-2'>
      <div className='min-w-0 flex-1'>
        <div className={cn('truncate text-sm font-medium', credit)}>
          {localized(line.description)}
        </div>
        {localized(line.details) && (
          <div className='text-muted-foreground truncate text-xs'>
            {localized(line.details)}
          </div>
        )}
        <div className='text-muted-foreground text-xs tabular-nums'>
          {toNumber(line.qty)} × {formatEgp(line.unitPrice)}
          {discount > 0 && (
            <span>
              {' '}
              − {formatEgp(discount)} ({t('discount')})
            </span>
          )}
          {line.addedBy && <span> · {line.addedBy}</span>}
        </div>
      </div>
      <div
        className={cn('shrink-0 text-sm font-semibold tabular-nums', credit)}
      >
        {formatEgp(line.total)}
      </div>
    </div>
  )
}

function BillRow({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: 'muted' | 'bold' | 'credit'
}) {
  return (
    <div
      className={cn(
        'flex justify-between gap-2',
        emphasis === 'muted' && 'text-muted-foreground',
        emphasis === 'bold' && 'font-medium',
        emphasis === 'credit' && 'text-destructive'
      )}
    >
      <span>{label}</span>
      <span className='tabular-nums'>{value}</span>
    </div>
  )
}

type TicketSheetProps = {
  ticketId: number | null
  onOpenChange: (open: boolean) => void
}

/**
 * One ticket, read-only: who it was for, what was on it, the frozen bill,
 * what was paid, what went back, and — for a voided one — why. The till's
 * ticket screen laid out for a desk, with none of its actions.
 */
export function TicketSheet({ ticketId, onOpenChange }: TicketSheetProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const { data: ticket, isLoading } = useQuery({
    ...getTicketOptions({
      path: { id: ticketId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: ticketId != null,
  })

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const formatAt = (value: string | null | undefined) =>
    value ? dateTime.format(new Date(value)) : ''

  const isSettled = ticket?.status === 'Settled'
  // Keyed on voidedAt rather than the status string so a voided ticket
  // renders its tombstone even if the status enum ever gains states
  const isVoided = ticket?.voidedAt != null
  const statusKey = ticket?.status ? ticketStatusKey[ticket.status] : undefined
  const typeKey = ticketTypeKey(ticket?.type)

  const lines = ticket?.lines ?? []
  const groups = groupLines(lines)
  const singleGroup = groups.length === 1 && groups[0].key === null
  const payments = ticket?.payments ?? []
  const refunds = ticket?.refunds ?? []
  const service = toNumber(ticket?.serviceCharge)
  const vat = toNumber(ticket?.vat)
  const change = toNumber(ticket?.changeGiven)
  const refunded = toNumber(ticket?.refundedTotal)

  const title = ticket ? ticketTitle(ticket, localized, t) : ''
  const meta = ticket
    ? [
        typeKey ? t(typeKey) : ticket.type,
        ticket.receiptNumber != null
          ? t('receiptNumber', { number: toNumber(ticket.receiptNumber) })
          : null,
        ticket.settledAt
          ? `${t('settledAtLabel')} ${formatAt(ticket.settledAt)}${ticket.settledBy ? ` · ${ticket.settledBy}` : ''}`
          : `${t('openedAt')} ${formatAt(ticket.openedAt)}`,
        ticket.shiftId != null
          ? t('shiftNumber', { id: toNumber(ticket.shiftId) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ' '

  return (
    <Sheet open={ticketId != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <div className='flex items-center gap-2'>
            <SheetTitle className='truncate'>
              {title}
              <span className='text-muted-foreground ms-2 text-base font-medium tabular-nums'>
                #{toNumber(ticket?.id ?? ticketId)}
              </span>
            </SheetTitle>
            {statusKey && (
              <Badge
                variant={
                  isVoided ? 'destructive' : isSettled ? 'secondary' : 'default'
                }
              >
                {t(statusKey)}
              </Badge>
            )}
          </div>
          <SheetDescription>{meta}</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 px-4 pb-4'>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-5 w-2/3' />
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </div>
          ) : ticket ? (
            <>
              {/* A voided ticket keeps its lines for the record; what is
                  left of it is the audit trail */}
              {isVoided && (
                <div className='border-destructive/30 bg-destructive/5 rounded-lg border p-3 text-sm'>
                  <div className='text-destructive flex items-center gap-2 font-medium'>
                    <Ban className='h-4 w-4' />
                    {t('statusVoided')}
                  </div>
                  {ticket.voidReason && (
                    <p className='mt-1'>{ticket.voidReason}</p>
                  )}
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {[
                      ticket.voidedBy
                        ? `${t('voidedBy')} ${ticket.voidedBy}`
                        : null,
                      formatAt(ticket.voidedAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              )}

              <div>
                <h4 className='mb-1 text-sm font-medium'>{t('items')}</h4>
                {lines.length === 0 ? (
                  <p className='text-muted-foreground py-2 text-sm'>
                    {t('emptyTicket')}
                  </p>
                ) : singleGroup ? (
                  <div className='divide-y'>
                    {lines.map((line) => (
                      <LineRow key={String(line.id)} line={line} />
                    ))}
                  </div>
                ) : (
                  /* Shared bill: one heading per person with their own
                     subtotal, so the reader sees who owed what */
                  <div className='space-y-3'>
                    {groups.map((group) => (
                      <div key={group.key ?? '__unattributed__'}>
                        <div className='bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm'>
                          <span className='flex min-w-0 items-center gap-2 font-medium'>
                            <User className='h-4 w-4 shrink-0' />
                            <span className='truncate'>
                              {group.name ?? (group.key ? t('guest') : title)}
                            </span>
                          </span>
                          <span className='shrink-0 tabular-nums'>
                            {formatEgp(group.total)}
                          </span>
                        </div>
                        <div className='divide-y px-3'>
                          {group.lines.map((line) => (
                            <LineRow key={String(line.id)} line={line} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* The bill as settled — frozen figures and the rates behind
                  them; VAT shown out of an inclusive price, or added on top */}
              <div className='space-y-1 text-sm'>
                {(service > 0 || vat > 0) && (
                  <BillRow
                    label={t('subtotal')}
                    value={formatEgp(ticket.subtotal)}
                    emphasis='muted'
                  />
                )}
                {service > 0 && (
                  <BillRow
                    label={t('serviceChargeRate', {
                      rate: percent(ticket.serviceChargeRate),
                    })}
                    value={formatEgp(service)}
                    emphasis='muted'
                  />
                )}
                {vat > 0 && !ticket.vatIncluded && (
                  <BillRow
                    label={t('vatRate', { rate: percent(ticket.vatRate) })}
                    value={formatEgp(vat)}
                    emphasis='muted'
                  />
                )}
                <BillRow
                  label={t('total')}
                  value={formatEgp(ticket.total)}
                  emphasis='bold'
                />
                {vat > 0 && ticket.vatIncluded && (
                  <BillRow
                    label={t('vatIncludedRate', {
                      rate: percent(ticket.vatRate),
                    })}
                    value={formatEgp(vat)}
                    emphasis='muted'
                  />
                )}
                {change > 0 && (
                  <BillRow
                    label={t('changeDue')}
                    value={formatEgp(change)}
                    emphasis='muted'
                  />
                )}
                {refunded > 0 && (
                  <BillRow
                    label={t('refunded')}
                    value={`−${formatEgp(refunded)}`}
                    emphasis='credit'
                  />
                )}
              </div>

              {payments.length > 0 && (
                <>
                  <Separator />
                  <div className='space-y-2'>
                    <h4 className='text-sm font-medium'>{t('tillPayments')}</h4>
                    {payments.map((payment, index) => (
                      <div
                        key={index}
                        className='flex items-center justify-between gap-3 text-sm'
                      >
                        <div className='flex min-w-0 items-center gap-2'>
                          <TenderBadge tender={payment.tender} />
                          <span className='text-muted-foreground truncate text-xs'>
                            {[
                              payment.customerName,
                              payment.recordedBy,
                              formatAt(payment.recordedAt),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                        <span className='font-medium tabular-nums'>
                          {formatEgp(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Credit notes: money that went back, each with its reason
                  and the lines it gave back */}
              {refunds.length > 0 && (
                <>
                  <Separator />
                  <div className='space-y-2'>
                    <h4 className='text-sm font-medium'>{t('creditNotes')}</h4>
                    {refunds.map((refund) => {
                      const refundLines = refund.lines ?? []
                      return (
                        <div
                          key={String(refund.id)}
                          className='border-destructive/30 bg-destructive/5 rounded-lg border p-3 text-sm'
                        >
                          <div className='flex items-baseline justify-between gap-2'>
                            <span className='font-medium'>
                              {t('creditNote', {
                                number: toNumber(refund.number),
                              })}
                            </span>
                            <span className='text-destructive font-semibold tabular-nums'>
                              −{formatEgp(refund.amount)}
                            </span>
                          </div>
                          <p className='mt-1'>{refund.reason}</p>
                          <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs'>
                            <TenderBadge tender={refund.tender} />
                            <span>
                              {[
                                refund.customerName,
                                refund.refundedBy,
                                formatAt(refund.refundedAt),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                          {refundLines.length > 0 && (
                            <div className='mt-2 divide-y border-t'>
                              {refundLines.map((line, index) => (
                                <div
                                  key={index}
                                  className='flex justify-between gap-2 py-1 text-xs'
                                >
                                  <span className='truncate'>
                                    {localized(line.description)} ×{' '}
                                    {toNumber(line.qty)}
                                  </span>
                                  <span className='tabular-nums'>
                                    −{formatEgp(line.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>{t('failedToLoad')}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
