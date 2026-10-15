import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useNow } from '@/lib/business-clock'
import { previousWindow } from '@/lib/business-day'
import { useT, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { MetricStrip, MetricTile } from '@/components/kit'
import { CountUp } from '@/components/motion'
import { PaymentsList } from './components/payments-list'
import { RefundsList } from './components/refunds-list'
import { TabPaymentsList } from './components/tab-payments-list'
import { TICKET_TYPES } from './components/tender'
import { TenderSeriesView } from './components/tender-series'
import { TicketsList } from './components/tickets-list'
import { netStatement } from './report-math'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/')

type TillView = 'tickets' | 'payments' | 'refunds' | 'tab-payments'

// Where a sale came from (the range report's byChannel): the ticket types,
// with delivery and platform orders apart from the counter they settle at.
// Each shows what customers paid, before refunds.
const CHANNELS: { name: string; labelKey: TranslationKey; always: boolean }[] =
  [
    ...TICKET_TYPES.map(({ name, labelKey }) => ({
      name,
      labelKey,
      always: true,
    })),
    { name: 'Delivery', labelKey: 'channelDelivery', always: false },
    { name: 'Platform', labelKey: 'channelPlatform', always: false },
  ]

/**
 * Settled sales over a window of business days. Net sales (what customers
 * paid less the refunds given back) is the one big number, compared with
 * the same stretch of the period before; the strip carries the lines that
 * make it up; the tenders and the statement sit side by side. Every number
 * opens the list behind it right under the report, on this page.
 *
 * Tenders come as two series: what the bills were paid with (cash after
 * the change) and the tab payments, which are money in but not sales. "On
 * account" is what was charged to customers' accounts, paid off later
 * through those tab payments.
 */
export function TillReport() {
  const t = useT()
  const features = useFeatures()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, hours, fromIso, toIso } = useTillWindow(search)
  const now = useNow()

  // A typed receipt number opens the tickets list on that one bill
  const view: TillView | undefined =
    search.view ?? (search.receipt != null ? 'tickets' : undefined)

  const report = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null,
  })

  // As many business days right before this window, cut to the same time
  // into them while this one is still going (to the 5 minutes, so the
  // query is not asked again every tick)
  const previousSpan =
    dayWindow && hours ? previousWindow(dayWindow, hours, now) : null
  const previous = previousSpan
    ? {
        from: previousSpan.from,
        to: new Date(
          previousSpan.from.getTime() +
            Math.floor(
              (previousSpan.to.getTime() - previousSpan.from.getTime()) /
                300_000
            ) *
              300_000
        ),
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
  const net = toNumber(data?.netSales)
  const bills = toNumber(data?.ticketsSettled)
  const refunds = toNumber(data?.refunds)
  const previousNet = toNumber(previousReport.data?.netSales)
  const delta =
    previousReport.data && previousNet > 0
      ? ((net - previousNet) / previousNet) * 100
      : null

  const channelTotals = new Map(
    (data?.byChannel ?? []).map((row) => [row.channel, row])
  )
  const statement = netStatement(data)
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
        // A receipt number, digits only: no browser spinner, the date picker's height
        <InputGroup className='h-9 w-44'>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            inputMode='numeric'
            pattern='[0-9]*'
            aria-label={t('findReceipt')}
            placeholder={t('findReceipt')}
            value={search.receipt ?? ''}
            onChange={(event) => {
              const value = Number(event.target.value.replace(/\D/g, ''))
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
          />
        </InputGroup>
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
                  <TenderSeriesView
                    report={data}
                    billsSearch={(tender) =>
                      open('payments', { tender: String(tender) })
                    }
                    tabsSearch={() => open('tab-payments')}
                  />
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
                    {statement.map((line) => (
                      <div
                        key={line.key}
                        className={cn(
                          'flex justify-between gap-3',
                          line.sign === '=' && 'border-t pt-2 font-semibold',
                          line.sign === 'of' && 'ps-3 text-xs'
                        )}
                      >
                        <dt
                          className={cn(
                            line.sign !== '=' && 'text-muted-foreground'
                          )}
                        >
                          {t(line.labelKey)}
                        </dt>
                        <dd
                          className={cn(
                            'tabular-nums',
                            line.sign === '−' && 'text-destructive',
                            line.sign === 'of' && 'text-muted-foreground'
                          )}
                        >
                          {line.sign === '−' || line.sign === '+'
                            ? line.sign
                            : ''}
                          {formatEgp(line.amount)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className='gap-3'>
            <CardHeader>
              <CardTitle>{t('byChannel')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className='h-24' />
              ) : (
                <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-5'>
                  {CHANNELS.filter(
                    ({ name, always }) => always || channelTotals.has(name)
                  ).map(({ name, labelKey }) => {
                    const row = channelTotals.get(name)
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
                          {formatEgp(row?.gross)}
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
