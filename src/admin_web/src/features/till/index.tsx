import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RangeToolbar } from './components/range-toolbar'
import { StatTile } from './components/stat-tile'
import { TENDERS, TICKET_TYPES } from './components/tender'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/')

/**
 * Settled sales over a window of business days: the money tiles, the tender
 * split and the per-type counts, all from one RangeReport. The window is
 * resolved client-side from the branch's day bounds and sent as UTC.
 */
export function TillSalesReport() {
  const t = useT()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  const report = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null,
  })
  const data = report.data
  const tenderTotals = new Map(
    (data?.tenderTotals ?? []).map((row) => [row.tender, row])
  )
  const typeTotals = new Map((data?.byType ?? []).map((row) => [row.type, row]))

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('tillSales')}
          </h1>
          <p className='text-muted-foreground'>{t('tillSalesSubtitle')}</p>
        </div>

        <RangeToolbar
          search={search}
          dayWindow={dayWindow}
          onChange={(next) =>
            navigate({ search: (prev) => ({ ...prev, ...next }) })
          }
        />

        {!dayWindow || report.isPending ? (
          <div className='space-y-4'>
            <Skeleton className='h-24 w-full' />
            <Skeleton className='h-48 w-full' />
          </div>
        ) : (
          <>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <StatTile
                label={t('posTicketsSettled')}
                value={String(toNumber(data?.ticketsSettled))}
              />
              <StatTile label={t('netSales')} value={formatEgp(data?.net)} />
              <StatTile
                label={t('subtotal')}
                value={formatEgp(data?.subtotal)}
              />
              <StatTile
                label={t('serviceChargeTotal')}
                value={formatEgp(data?.serviceCharge)}
              />
              <StatTile label={t('vatTotal')} value={formatEgp(data?.vat)} />
              <StatTile
                label={t('discountsTotal')}
                value={formatEgp(data?.discounts)}
              />
              <StatTile
                label={t('refundsTotal')}
                value={formatEgp(data?.refunds)}
                hint={t('refundsCount', { count: toNumber(data?.refundCount) })}
              />
              <StatTile
                label={t('changeGiven')}
                value={formatEgp(data?.changeGiven)}
              />
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>{t('tenderSplit')}</CardTitle>
                </CardHeader>
                <CardContent className='space-y-1.5'>
                  {TENDERS.map(({ name, labelKey }) => {
                    const row = tenderTotals.get(name)
                    return (
                      <div
                        key={name}
                        className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'
                      >
                        <span>{t(labelKey)}</span>
                        <span className='flex items-baseline gap-2'>
                          <span className='text-muted-foreground text-xs'>
                            {t('paymentsCount', {
                              count: toNumber(row?.count),
                            })}
                          </span>
                          <span className='font-medium tabular-nums'>
                            {formatEgp(row?.amount)}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('byTicketType')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-3 gap-2'>
                    {TICKET_TYPES.map(({ name, labelKey }) => {
                      const row = typeTotals.get(name)
                      return (
                        <div
                          key={name}
                          className='rounded-lg border px-3 py-2 text-center'
                        >
                          <div className='text-lg font-bold tabular-nums'>
                            {toNumber(row?.count)}
                          </div>
                          <p className='text-muted-foreground text-xs'>
                            {t(labelKey)}
                          </p>
                          <p className='text-muted-foreground text-xs tabular-nums'>
                            {formatEgp(row?.net)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Main>
    </>
  )
}
