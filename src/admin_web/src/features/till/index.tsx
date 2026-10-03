import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { MetricStrip, MetricTile } from '@/components/kit'
import { CountUp } from '@/components/motion'
import { SegmentedBar } from '@/components/segmented-bar'
import { PaymentsList } from './components/payments-list'
import { RefundsList } from './components/refunds-list'
import { TabPaymentsList } from './components/tab-payments-list'
import { TICKET_TYPES, tendersFor } from './components/tender'
import { TicketsList } from './components/tickets-list'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/')

type TillView = 'tickets' | 'payments' | 'refunds' | 'tab-payments'

/**
 * Settled sales over a window of business days. Net is the one big number,
 * compared with the period before; the strip carries the lines that make it
 * up; the tender split and the per-type counts sit side by side. Every
 * number opens the list behind it right under the report, on this page.
 *
 * A tender's segment counts everything that went through it — payments on
 * tickets plus tab payments — so InstaPay reads what the InstaPay app will
 * show, not just what settled a bill. "On account" is what was charged to
 * customers' accounts, and is paid off later through those tab payments.
 */
export function TillReport() {
  const t = useT()
  const features = useFeatures()
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
  const bills = toNumber(data?.ticketsSettled)
  const refunds = toNumber(data?.refunds)
  const previousNet = toNumber(previousReport.data?.net)
  const delta =
    previousReport.data && previousNet > 0
      ? ((net - previousNet) / previousNet) * 100
      : null

  const tenderTotals = new Map(
    (data?.tenderTotals ?? []).map((row) => [row.tender, row])
  )
  const tabTenderTotals = new Map(
    (data?.tabPaymentTenderTotals ?? []).map((row) => [row.tender, row])
  )
  const typeTotals = new Map((data?.byType ?? []).map((row) => [row.type, row]))
  const range = {
    range: search.range,
    from: search.from,
    to: search.to,
    fromTime: search.fromTime,
    toTime: search.toTime,
  }
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

  const viewTitle: Record<TillView, string> = {
    tickets: t('tillTickets'),
    payments: t('tillPayments'),
    refunds: t('tillRefunds'),
    'tab-payments': t('tabPayments'),
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
            className='w-[160px] ps-8'
          />
        </div>
      }
    >
      {report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <>
          {/* The numbers the till is opened for, on one strip; each opens the list behind it */}
          <MetricStrip>
            <MetricTile
              label={t('netSales')}
              value={<CountUp value={net} format={formatEgp} />}
              change={delta != null ? delta / 100 : undefined}
              hint={t('againstPeriodBefore')}
              loading={loading}
            />
            <MetricTile
              label={t('posTicketsSettled')}
              value={<CountUp value={bills} />}
              loading={loading}
              to='/till'
              search={open('tickets')}
            />
            <MetricTile
              label={t('averageBill')}
              value={bills > 0 ? formatEgp(net / bills) : '—'}
              loading={loading}
            />
            <MetricTile
              label={t('refundsTotal')}
              value={
                <span className={cn(refunds > 0 && 'text-destructive')}>
                  {refunds > 0 ? `−${formatEgp(refunds)}` : formatEgp(0)}
                </span>
              }
              hint={t('refundsCount', { count: toNumber(data?.refundCount) })}
              loading={loading}
              to='/till'
              search={open('refunds')}
            />
            {features.tabs && (
              <MetricTile
                label={t('tabPayments')}
                value={formatEgp(data?.tabPayments)}
                hint={t('paymentsCount', {
                  count: toNumber(data?.tabPaymentCount),
                })}
                loading={loading}
                to='/till'
                search={open('tab-payments')}
              />
            )}
          </MetricStrip>

          <div className='grid gap-4 lg:grid-cols-3'>
            <Card className='gap-3 lg:col-span-2'>
              <CardHeader>
                <CardTitle>{t('tenderSplit')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className='h-40' />
                ) : (
                  <SegmentedBar
                    segments={tendersFor(
                      features.onlinePayments,
                      toNumber(tenderTotals.get('Online')?.amount) > 0,
                      toNumber(tenderTotals.get('Talabat')?.amount) > 0
                    ).map(({ name, value, labelKey }) => {
                      const payments = toNumber(tenderTotals.get(name)?.count)
                      const slips = toNumber(tabTenderTotals.get(name)?.count)
                      const amount =
                        toNumber(tenderTotals.get(name)?.amount) +
                        toNumber(tabTenderTotals.get(name)?.amount)
                      // "3 payments · 1 tab payment": each kind only when there is one
                      const hint =
                        [
                          payments > 0 &&
                            t('paymentsCount', { count: payments }),
                          slips > 0 && t('tabPaymentsCount', { count: slips }),
                        ]
                          .filter(Boolean)
                          .join(' · ') || t('paymentsCount', { count: 0 })
                      return {
                        key: name,
                        label: t(labelKey),
                        value: amount,
                        display: formatEgp(amount),
                        hint,
                        to: '/till' as const,
                        search: open('payments', { tender: String(value) }),
                      }
                    })}
                  />
                )}
                {!loading && toNumber(data?.changeGiven) > 0 && (
                  <p className='text-muted-foreground mt-3 text-xs tabular-nums'>
                    {t('changeGivenNote', {
                      amount: formatEgp(data?.changeGiven),
                    })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* How the net is made, as a short statement: the figures an accountant wants, in their order */}
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('howNetIsMade')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className='h-40' />
                ) : (
                  <dl className='grid gap-2 text-sm'>
                    {[
                      [t('subtotal'), toNumber(data?.subtotal), ''],
                      [
                        t('serviceChargeTotal'),
                        toNumber(data?.serviceCharge),
                        '+',
                      ],
                      [t('vatTotal'), toNumber(data?.vat), '+'],
                      [t('discountsTotal'), toNumber(data?.discounts), '−'],
                      [t('refundsTotal'), refunds, '−'],
                    ]
                      .filter(([, amount, sign]) => !sign || Number(amount) > 0)
                      .map(([label, amount, sign]) => (
                        <div
                          key={String(label)}
                          className='flex justify-between gap-3'
                        >
                          <dt className='text-muted-foreground'>{label}</dt>
                          <dd
                            className={cn(
                              'tabular-nums',
                              sign === '−' && 'text-destructive'
                            )}
                          >
                            {sign}
                            {formatEgp(Number(amount))}
                          </dd>
                        </div>
                      ))}
                    <div className='mt-1 flex justify-between gap-3 border-t pt-2 font-semibold'>
                      <dt>{t('netSales')}</dt>
                      <dd className='tabular-nums'>{formatEgp(net)}</dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className='gap-3'>
            <CardHeader>
              <CardTitle>{t('byTicketType')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className='h-24' />
              ) : (
                <div className='grid gap-3 sm:grid-cols-3'>
                  {TICKET_TYPES.map(({ name, labelKey }) => {
                    const row = typeTotals.get(name)
                    return (
                      <Link
                        key={name}
                        to='/till'
                        search={open('tickets')}
                        className='bg-muted/40 hover:bg-muted rounded-lg p-3 transition-colors'
                      >
                        <div className='text-muted-foreground text-xs'>
                          {t(labelKey)}
                        </div>
                        <div className='mt-0.5 font-semibold tabular-nums'>
                          {formatEgp(row?.net)}
                        </div>
                        <div className='text-muted-foreground text-xs tabular-nums'>
                          {t('posTicketsCount', {
                            count: toNumber(row?.count),
                          })}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {view && (
            <section
              ref={drill}
              className='scroll-mt-20 space-y-3 border-t pt-4'
            >
              <div className='flex items-center justify-between gap-2'>
                <h2 className='text-sm font-semibold'>{viewTitle[view]}</h2>
                <Button variant='ghost' size='sm' onClick={closeView}>
                  <X />
                  {t('close')}
                </Button>
              </div>
              {view === 'tickets' && <TicketsList />}
              {view === 'payments' && <PaymentsList />}
              {view === 'refunds' && <RefundsList />}
              {view === 'tab-payments' && features.tabs && <TabPaymentsList />}
            </section>
          )}
        </>
      )}
    </TillPage>
  )
}
