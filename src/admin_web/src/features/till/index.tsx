import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { SegmentedBar } from '@/components/segmented-bar'
import { Stat, StatStrip } from '@/components/stat-strip'
import { PaymentsList } from './components/payments-list'
import { RefundsList } from './components/refunds-list'
import { TENDERS, TICKET_TYPES } from './components/tender'
import { TicketsList } from './components/tickets-list'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/')

export type TillView = 'tickets' | 'payments' | 'refunds'

/**
 * Settled sales over a window of business days. Net is the one big number,
 * compared with the period before; the strip carries the lines that make it
 * up; the tender split and the per-type counts sit side by side. Every
 * number opens the list behind it right under the report, on this page.
 */
export function TillReport() {
  const t = useT()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  // A typed receipt number opens the tickets list on that one bill
  const view: TillView | undefined =
    search.view ?? (search.receipt != null ? 'tickets' : undefined)

  const report = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null,
  })

  // The same-length window right before this one, for the comparison
  const previous = dayWindow
    ? {
        from: new Date(
          dayWindow.from.getTime() -
            (dayWindow.to.getTime() - dayWindow.from.getTime())
        ),
        to: dayWindow.from,
      }
    : null
  const previousReport = useQuery({
    ...getRangeReportOptions({
      query: {
        'api-version': API_VERSION,
        from: previous?.from.toISOString() ?? '',
        to: previous?.to.toISOString() ?? '',
      },
    }),
    enabled: previous !== null,
  })

  const data = report.data
  const net = toNumber(data?.net)
  const previousNet = toNumber(previousReport.data?.net)
  const delta =
    previousReport.data && previousNet > 0
      ? ((net - previousNet) / previousNet) * 100
      : null

  const tenderTotals = new Map(
    (data?.tenderTotals ?? []).map((row) => [row.tender, row])
  )
  const typeTotals = new Map((data?.byType ?? []).map((row) => [row.type, row]))
  const range = { range: search.range, from: search.from, to: search.to }
  const loading = !dayWindow || report.isPending

  // The list a number opens: same route, a `view` in the URL
  const open = (next: TillView, extra: Partial<typeof search> = {}) => ({
    ...range,
    view: next,
    page: undefined,
    status: undefined,
    tender: undefined,
    receipt: undefined,
    ...extra,
  })
  const closeView = () =>
    navigate({
      search: (prev) => ({
        ...prev,
        view: undefined,
        page: undefined,
        status: undefined,
        tender: undefined,
        receipt: undefined,
      }),
    })

  // Bring the opened list into view; the report above stays where it is
  const drill = useRef<HTMLElement>(null)
  useEffect(() => {
    if (view)
      drill.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [view, search.tender, search.status])

  const active = (which: TillView, tender?: string) =>
    view === which && (tender === undefined || search.tender === tender)
      ? 'bg-accent/50'
      : undefined

  const viewTitle: Record<TillView, string> = {
    tickets: t('tillTickets'),
    payments: t('tillPayments'),
    refunds: t('tillRefunds'),
  }

  return (
    <TillPage
      tab='report'
      search={search}
      dayWindow={dayWindow}
      onRangeChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            page: undefined,
            receipt: undefined,
            ...next,
          }),
        })
      }
      headerExtra={
        <div className='relative'>
          <Search className='text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
          <Input
            type='number'
            inputMode='numeric'
            min={1}
            aria-label={t('findReceipt')}
            placeholder={t('findReceipt')}
            value={search.receipt ?? ''}
            onChange={(event) => {
              const value = Number(event.target.value)
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: undefined,
                  receipt: value > 0 ? value : undefined,
                  view: value > 0 ? 'tickets' : prev.view,
                  status: undefined,
                }),
              })
            }}
            className='h-8 w-[160px] ps-8'
          />
        </div>
      }
    >
      {report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <Stat
              size='hero'
              label={t('netSales')}
              value={formatEgp(net)}
              loading={loading}
              hint={
                delta != null ? (
                  <span
                    className={cn(
                      'font-medium',
                      delta > 0 && 'text-success',
                      delta < 0 && 'text-destructive'
                    )}
                  >
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(0)}% {t('vsPreviousPeriod')}
                  </span>
                ) : undefined
              }
            />
            {!loading && toNumber(data?.changeGiven) > 0 && (
              <span className='text-muted-foreground text-sm tabular-nums'>
                {t('changeGivenNote', {
                  amount: formatEgp(data?.changeGiven),
                })}
              </span>
            )}
          </div>

          <StatStrip>
            <Stat
              label={t('posTicketsSettled')}
              value={String(toNumber(data?.ticketsSettled))}
              loading={loading}
              to='/till'
              search={open('tickets')}
              className={active('tickets')}
            />
            <Stat
              label={t('subtotal')}
              value={formatEgp(data?.subtotal)}
              loading={loading}
            />
            <Stat
              label={t('serviceChargeTotal')}
              value={formatEgp(data?.serviceCharge)}
              loading={loading}
            />
            <Stat
              label={t('vatTotal')}
              value={formatEgp(data?.vat)}
              loading={loading}
            />
            <Stat
              label={t('discountsTotal')}
              value={formatEgp(data?.discounts)}
              loading={loading}
            />
            <Stat
              label={t('refundsTotal')}
              value={`−${formatEgp(data?.refunds)}`}
              hint={t('refundsCount', { count: toNumber(data?.refundCount) })}
              tone={toNumber(data?.refunds) > 0 ? 'negative' : 'default'}
              loading={loading}
              to='/till'
              search={open('refunds')}
              className={active('refunds')}
            />
            <Stat
              label={t('tabPayments')}
              value={formatEgp(data?.tabPayments)}
              hint={t('paymentsCount', {
                count: toNumber(data?.tabPaymentCount),
              })}
              loading={loading}
              to='/till'
              search={open('payments', { tender: '3' })}
              className={active('payments', '3')}
            />
          </StatStrip>

          <div className='grid gap-10 lg:grid-cols-2'>
            <section>
              <h2 className='mb-3 text-sm font-semibold'>{t('tenderSplit')}</h2>
              {loading ? (
                <Skeleton className='h-40' />
              ) : (
                <SegmentedBar
                  segments={TENDERS.map(({ name, value, labelKey }) => {
                    const row = tenderTotals.get(name)
                    return {
                      key: name,
                      label: t(labelKey),
                      value: toNumber(row?.amount),
                      display: formatEgp(row?.amount),
                      hint: t('paymentsCount', { count: toNumber(row?.count) }),
                      to: '/till' as const,
                      search: open('payments', { tender: String(value) }),
                    }
                  })}
                />
              )}
            </section>

            <section>
              <h2 className='mb-3 text-sm font-semibold'>
                {t('byTicketType')}
              </h2>
              {loading ? (
                <Skeleton className='h-40' />
              ) : (
                <ul className='divide-y text-sm'>
                  {TICKET_TYPES.map(({ name, labelKey }) => {
                    const row = typeTotals.get(name)
                    return (
                      <li key={name}>
                        <Link
                          to='/till'
                          search={open('tickets')}
                          className='hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors'
                        >
                          <span className='flex-1'>{t(labelKey)}</span>
                          <span className='text-muted-foreground text-xs tabular-nums'>
                            {t('posTicketsCount', {
                              count: toNumber(row?.count),
                            })}
                          </span>
                          <span className='font-medium tabular-nums'>
                            {formatEgp(row?.net)}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {view && (
            <section
              ref={drill}
              className='scroll-mt-20 space-y-3 border-t pt-4'
            >
              <div className='flex items-center justify-between gap-2'>
                <h2 className='text-sm font-semibold'>{viewTitle[view]}</h2>
                <Button variant='ghost' size='sm' onClick={closeView}>
                  <X className='me-1.5 h-4 w-4' />
                  {t('close')}
                </Button>
              </div>
              {view === 'tickets' && <TicketsList />}
              {view === 'payments' && <PaymentsList />}
              {view === 'refunds' && <RefundsList />}
            </section>
          )}
        </>
      )}
    </TillPage>
  )
}
