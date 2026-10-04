import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { History, Motorbike } from 'lucide-react'
import { type RiderDeliveryRow } from '@/api/ordering'
import {
  getRiderDeliveriesOptions,
  getRidersOverviewOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useT } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createAppColumnHelper,
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { DateRangePicker } from '@/components/date-range-picker'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { MetricStrip, MetricTile } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'
import { useTillWindow } from '@/features/till/use-till-window'
import {
  addressLine,
  cashDifferenceTone,
  isOpenForRider,
  MAX_HISTORY_DAYS,
  num,
  stageLabel,
  stageTone,
  windowTooWide,
} from './format'
import { LastSeen, PresenceChip } from './index'
import { TimelineDialog } from './timeline-dialog'

const route = getRouteApi('/_authenticated/riders/$userId')

const columnHelper = createAppColumnHelper<RiderDeliveryRow>()

/** Where it stands for this rider; one taken from them says when, and to whom */
function StageCell({ row }: { row: RiderDeliveryRow }) {
  const t = useT()
  return (
    <div className='flex flex-col items-start gap-1'>
      <StatusChip tone={stageTone(row.stage)}>
        {t(stageLabel(row.stage))}
      </StatusChip>
      {row.stillWithRider === false && (
        <span className='text-muted-foreground text-xs'>
          {row.givenToRiderName && (
            <>{t('riderGivenTo', { name: row.givenToRiderName })} · </>
          )}
          {row.takenFromRiderAt && (
            <When value={row.takenFromRiderAt} mode='dateTime' />
          )}
        </span>
      )}
      {row.stage === 'Failed' && row.failureReason && (
        <span className='text-muted-foreground text-xs'>
          “{row.failureReason}”
        </span>
      )}
    </div>
  )
}

/** What they handed in, and how it stood against what was due: short in red, over in amber */
function CashCell({ row }: { row: RiderDeliveryRow }) {
  const t = useT()
  if (row.cashCollected == null) {
    return <span className='text-muted-foreground'>—</span>
  }
  const tone = cashDifferenceTone(row.cashDifference)
  const difference = Math.abs(num(row.cashDifference))
  return (
    <Money
      value={row.cashCollected}
      sub={
        tone === 'short' ? (
          <span className='text-destructive font-medium'>
            {t('riderShort', { amount: formatEgp(difference) })}
          </span>
        ) : tone === 'over' ? (
          <span className='font-medium text-amber-600 dark:text-amber-400'>
            {t('riderOver', { amount: formatEgp(difference) })}
          </span>
        ) : (
          t('riderEven')
        )
      }
    />
  )
}

/**
 * One rider: where they stand now, what is out with them, and every
 * delivery they were given in a window (those taken from them too), a page
 * at a time, with the window's figures. A row's Timeline shows each step of
 * that delivery, with who took it.
 */
export function RiderPage({ userId }: { userId: string }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [timelineOrder, setTimelineOrder] = useState<number | null>(null)

  // The rider as the Riders page has them: served from its cache when it was open
  const overview = useQuery({
    ...getRidersOverviewOptions({
      query: {
        'api-version': API_VERSION,
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      },
    }),
    refetchInterval: 60_000,
  })
  const rider = overview.data?.find((r) => r.userId === userId)

  // Now: what is still with them, whenever it was given. A window fixed when
  // the page opens, reaching a day ahead, so a delivery given later still
  // falls in it when the hub refreshes the list
  const [nowWindow] = useState(() => {
    const now = Date.now()
    return {
      from: new Date(now - 7 * 86_400_000).toISOString(),
      to: new Date(now + 86_400_000).toISOString(),
    }
  })
  const current = useQuery({
    ...getRiderDeliveriesOptions({
      path: { userId },
      query: {
        'api-version': API_VERSION,
        from: nowWindow.from,
        to: nowWindow.to,
        page: 1,
        pageSize: 100,
      },
    }),
  })
  const openNow = (current.data?.items ?? []).filter(isOpenForRider)

  // The history's window: the shared picker, by the branch's business days
  const { dayWindow, ready, fromIso, toIso } = useTillWindow(search)
  const tooWide = windowTooWide(dayWindow?.from, dayWindow?.to)

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const history = useQuery({
    ...getRiderDeliveriesOptions({
      path: { userId },
      query: {
        'api-version': API_VERSION,
        from: fromIso,
        to: toIso,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      },
    }),
    enabled: ready && fromIso !== '' && !tooWide,
    placeholderData: keepPreviousData,
  })
  const rows = history.data?.items ?? []
  const summary = history.data?.summary

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor((row) => num(row.orderNumber), {
          id: 'order',
          header: t('riderOrderCol'),
          cell: ({ row }) => (
            <div className='flex flex-col leading-tight'>
              <span className='font-medium tabular-nums'>
                #{num(row.original.orderNumber)}
              </span>
              <span className='text-muted-foreground text-xs'>
                {row.original.customerName || '—'}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor((row) => addressLine(row), {
          id: 'address',
          header: t('riderAddressCol'),
          cell: ({ getValue }) => (
            <span className='line-clamp-2 max-w-[16rem] text-sm'>
              {getValue() || '—'}
            </span>
          ),
        }),
        columnHelper.accessor('stage', {
          header: t('riderStageCol'),
          cell: ({ row }) => <StageCell row={row.original} />,
        }),
        columnHelper.accessor('assignedAt', {
          header: t('riderGivenCol'),
          cell: ({ row }) => (
            <div className='flex flex-col leading-tight'>
              <When value={row.original.assignedAt} mode='dateTime' />
              {row.original.minutesOutToDelivered != null && (
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {t('riderMinutes', {
                    n: num(row.original.minutesOutToDelivered),
                  })}
                </span>
              )}
            </div>
          ),
        }),
        columnHelper.accessor((row) => num(row.total), {
          id: 'total',
          meta: { align: 'end' },
          header: t('total'),
          cell: ({ row }) => <Money value={row.original.total} strong />,
        }),
        columnHelper.accessor((row) => num(row.cashCollected), {
          id: 'cash',
          meta: { align: 'end' },
          header: t('riderCashCol'),
          cell: ({ row }) => <CashCell row={row.original} />,
        }),
        columnHelper.display({
          id: 'timeline',
          header: () => <span className='sr-only'>{t('riderTimeline')}</span>,
          cell: ({ row }) => (
            <Button
              variant='ghost'
              size='sm'
              onClick={(e) => {
                e.stopPropagation()
                setTimelineOrder(num(row.original.orderNumber))
              }}
            >
              <History />
              {t('riderTimeline')}
            </Button>
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(num(row.orderNumber)),
    enableSorting: false,
    manualPagination: true,
    manualFiltering: true,
    rowCount: num(history.data?.totalCount),
    state: { pagination },
    onPaginationChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (history.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data, pageCount])

  if (overview.data && !rider) {
    return (
      <Main>
        <PageHeader back={{ to: '/riders' }} title={t('ridersNav')} />
        <EmptyState icon={Motorbike} title={t('riderNotFound')} />
      </Main>
    )
  }

  const average = summary?.averageMinutesOutToDelivered
  const differenceTone = cashDifferenceTone(summary?.cashDifferenceTotal)

  return (
    <Main>
      <PageHeader
        back={{ to: '/riders' }}
        title={rider?.name ?? '…'}
        badge={rider && <PresenceChip status={rider.status} />}
      >
        {rider && (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm'>
            <span>{t('riderLastSeen')}:</span>
            <LastSeen rider={rider} />
            {rider.enabled === false && (
              <>
                <Dot />
                <span>{t('riderDisabled')}</span>
              </>
            )}
          </div>
        )}
      </PageHeader>

      {/* What is out with them right now */}
      <Card className='mb-4'>
        <CardHeader>
          <CardTitle className='text-base'>{t('riderNow')}</CardTitle>
        </CardHeader>
        <CardContent>
          {current.isError ? (
            <ErrorState
              size='section'
              error={current.error}
              onRetry={current.refetch}
            />
          ) : openNow.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {current.isLoading ? '…' : t('riderNothingNow')}
            </p>
          ) : (
            <ul className='divide-y'>
              {openNow.map((row) => (
                <li
                  key={num(row.orderNumber)}
                  className='py-2 first:pt-0 last:pb-0'
                >
                  <ListRow
                    title={
                      <span className='tabular-nums'>
                        #{num(row.orderNumber)}
                        {row.customerName && (
                          <span className='font-normal'>
                            {' '}
                            · {row.customerName}
                          </span>
                        )}
                      </span>
                    }
                    meta={
                      <>
                        <span className='truncate'>
                          {addressLine(row) || '—'}
                        </span>
                        <Dot />
                        <When value={row.outAt ?? row.assignedAt} />
                      </>
                    }
                    trailing={<Money value={row.total} strong />}
                    trailingMeta={
                      <StatusChip tone={stageTone(row.stage)}>
                        {t(stageLabel(row.stage))}
                      </StatusChip>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <h2 className='me-auto text-lg font-semibold'>{t('riderHistory')}</h2>
        <DateRangePicker
          search={search}
          dayWindow={dayWindow}
          compact
          onChange={(next) =>
            navigate({
              search: (prev) => ({ ...prev, ...next, page: undefined }),
            })
          }
        />
      </div>

      {tooWide ? (
        <EmptyState
          compact
          title={t('riderWindowTooWide', { days: MAX_HISTORY_DAYS })}
        />
      ) : history.isError ? (
        <ErrorState
          size='section'
          title={t('riderHistoryLoadFailed')}
          error={history.error}
          onRetry={history.refetch}
        />
      ) : (
        <>
          {/* The window's figures: only what stayed theirs counts */}
          <MetricStrip className='mb-4'>
            <MetricTile
              label={t('riderSummaryDelivered')}
              loading={history.isLoading}
              value={num(summary?.delivered)}
              hint={t('riderSummaryHint')}
            />
            <MetricTile
              label={t('riderSummaryFailed')}
              loading={history.isLoading}
              value={num(summary?.failed)}
            />
            <MetricTile
              label={t('riderSummaryReturned')}
              loading={history.isLoading}
              value={num(summary?.returned)}
            />
            <MetricTile
              label={t('riderSummaryCash')}
              loading={history.isLoading}
              value={formatEgp(summary?.cashCollected)}
            />
            <MetricTile
              label={t('riderSummaryDifference')}
              loading={history.isLoading}
              value={
                <span
                  className={cn(
                    differenceTone === 'short' && 'text-destructive',
                    differenceTone === 'over' &&
                      'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {formatEgp(summary?.cashDifferenceTotal, true)}
                </span>
              }
            />
            <MetricTile
              label={t('riderSummaryAverage')}
              loading={history.isLoading}
              value={
                average == null ? '—' : t('riderMinutes', { n: num(average) })
              }
            />
          </MetricStrip>

          <DataTable
            table={table}
            isLoading={history.isLoading || !ready}
            emptyMessage={t('riderHistoryEmpty')}
            onRowClick={(row) =>
              setTimelineOrder(num(row.original.orderNumber))
            }
            mobileRow={({ original: row }) => (
              <ListRow
                title={
                  <span className='tabular-nums'>
                    #{num(row.orderNumber)}
                    {row.customerName && (
                      <span className='font-normal'> · {row.customerName}</span>
                    )}
                  </span>
                }
                meta={
                  <>
                    <When value={row.assignedAt} mode='dateTime' />
                    {row.stillWithRider === false && row.givenToRiderName && (
                      <>
                        <Dot />
                        <span>
                          {t('riderGivenTo', { name: row.givenToRiderName })}
                        </span>
                      </>
                    )}
                  </>
                }
                trailing={<Money value={row.total} strong />}
                trailingMeta={
                  <StatusChip tone={stageTone(row.stage)}>
                    {t(stageLabel(row.stage))}
                  </StatusChip>
                }
              />
            )}
          />

          <DataTablePagination table={table} />
        </>
      )}

      <TimelineDialog
        orderId={timelineOrder}
        onOpenChange={(open) => !open && setTimelineOrder(null)}
      />
    </Main>
  )
}
