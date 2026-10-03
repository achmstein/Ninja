import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { type StayViewModel } from '@/api/spaces'
import {
  getStayHistoryOptions,
  listPlacesOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import {
  useLanguage,
  useLocale,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { dayHeading, dayKey } from '@/lib/when'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createAppColumnHelper,
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'
import {
  comparePlaces,
  formatDuration,
  STAY_CANCELLED,
  stayBreakdown,
} from './status'

const route = getRouteApi('/_authenticated/places/history')

type DateRange = 'today' | '7d' | '30d'

const dateRanges: { value: DateRange; key: TranslationKey; days: number }[] = [
  { value: 'today', key: 'today', days: 0 },
  { value: '7d', key: 'last7Days', days: 7 },
  { value: '30d', key: 'last30Days', days: 30 },
]

function rangeToFromDate(range: DateRange | undefined): string | undefined {
  if (!range) return undefined
  const days = dateRanges.find((r) => r.value === range)?.days ?? 0
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - days)
  return from.toISOString()
}

const columnHelper = createAppColumnHelper<StayViewModel>()

/** When a stay ran, in the day its group names: "14:00 – 16:30" */
function StaySpan({ stay }: { stay: StayViewModel }) {
  const start = stay.startedAt ?? stay.createdAt
  return (
    <span className='tabular-nums'>
      <When value={start} mode='time' />
      {stay.endedAt && (
        <>
          {' – '}
          <When value={stay.endedAt} mode='time' />
        </>
      )}
    </span>
  )
}

function stayDuration(stay: StayViewModel): string {
  return stay.startedAt && stay.endedAt
    ? formatDuration(stay.startedAt, stay.endedAt)
    : '—'
}

/** Paid (with its receipt), not paid, or cancelled, as a soft chip */
function StayPaid({ stay }: { stay: StayViewModel }) {
  const t = useT()
  if (Number(stay.status) === STAY_CANCELLED)
    return <StatusChip tone='danger'>{t('cancelled')}</StatusChip>
  return stay.paidAt ? (
    <StatusChip tone='success'>
      {stay.receiptNumber != null ? `#${stay.receiptNumber}` : t('paid')}
    </StatusChip>
  ) : (
    <StatusChip tone='warning'>{t('notPaid')}</StatusChip>
  )
}

/** Every ended or cancelled stay of the branch, by place and date range. */
export function StayHistory() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const fromDate = useMemo(() => rangeToFromDate(search.range), [search.range])

  // Only a timed place has stays to look back on
  const { data: places = [] } = useQuery(
    listPlacesOptions({ query: { timed: true } })
  )
  const timedPlaces = useMemo(
    () => [...places].sort(comparePlaces(localized)),
    [places, localized]
  )

  const historyQuery = useQuery({
    ...getStayHistoryOptions({
      query: {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        placeId: search.place,
        fromDate,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const stays = historyQuery.data?.items ?? []

  const historyColumns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor((row) => localized(row.placeName), {
          id: 'place',
          header: t('place'),
          cell: ({ row }) => (
            <div className='flex flex-col leading-tight'>
              <span className='font-medium'>
                {localized(row.original.placeName)}
              </span>
              <span className='text-muted-foreground text-xs'>
                {row.original.customerName || t('walkIn')}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor((row) => row.startedAt ?? row.createdAt ?? '', {
          id: 'when',
          header: t('started'),
          cell: ({ row }) => (
            <div className='flex flex-col leading-tight'>
              <StaySpan stay={row.original} />
              <span className='text-muted-foreground text-xs tabular-nums'>
                {stayDuration(row.original)}
              </span>
            </div>
          ),
        }),
        // Rounded steps per rate, exactly what went on the bill, under it
        columnHelper.accessor((row) => Number(row.totalCost ?? 0), {
          meta: { align: 'end' },
          id: 'total',
          header: t('total'),
          cell: ({ row }) => (
            <Money
              value={row.original.totalCost}
              strong
              dashZero={row.original.totalCost == null}
              sub={stayBreakdown(row.original, t, localized) || undefined}
            />
          ),
        }),
        columnHelper.display({
          id: 'paid',
          header: t('paid'),
          cell: ({ row }) => <StayPaid stay={row.original} />,
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: stays,
    columns: historyColumns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
    manualFiltering: true,
    rowCount: Number(historyQuery.data?.totalCount ?? 0),
    state: { pagination },
    onPaginationChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (historyQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, pageCount])

  return (
    <>
      <Main>
        <PageHeader back={{ to: '/places' }} title={t('timeHistory')}>
          <div className='flex items-center gap-2'>
            <Select
              value={search.place != null ? String(search.place) : 'all'}
              onValueChange={(value) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: undefined,
                    place: value === 'all' ? undefined : Number(value),
                  }),
                })
              }
            >
              <SelectTrigger size='sm' className='h-8 w-[160px]'>
                <SelectValue placeholder={t('allPlaces')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allPlaces')}</SelectItem>
                {timedPlaces.map((place) => (
                  <SelectItem key={String(place.id)} value={String(place.id)}>
                    {localized(place.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={search.range ?? 'all'}
              onValueChange={(value) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: undefined,
                    range: value === 'all' ? undefined : (value as DateRange),
                  }),
                })
              }
            >
              <SelectTrigger size='sm' className='h-8 w-[140px]'>
                <SelectValue placeholder={t('allTime')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allTime')}</SelectItem>
                {dateRanges.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PageHeader>

        <DataTable
          table={table}
          isLoading={historyQuery.isLoading}
          emptyMessage={t('noTimeHistory')}
          groupBy={{
            key: (row) => dayKey(row.startedAt ?? row.createdAt),
            label: (key) => dayHeading(key, locale, t),
          }}
          mobileRow={({ original: stay }) => (
            <ListRow
              title={localized(stay.placeName) || '—'}
              meta={
                <>
                  <span>{stay.customerName || t('walkIn')}</span>
                  <Dot />
                  <StaySpan stay={stay} />
                  {stay.startedAt && stay.endedAt && (
                    <>
                      <Dot />
                      <span className='tabular-nums'>{stayDuration(stay)}</span>
                    </>
                  )}
                </>
              }
              trailing={
                <Money
                  value={stay.totalCost}
                  strong
                  dashZero={stay.totalCost == null}
                />
              }
              trailingMeta={<StayPaid stay={stay} />}
            />
          )}
        />

        <DataTablePagination table={table} />
      </Main>
    </>
  )
}
