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
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
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
import { PageHeader } from '@/components/page-header'
import { formatEgp } from '@/features/orders/status'
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
            <span className='font-medium'>
              {localized(row.original.placeName) || '—'}
            </span>
          ),
        }),
        columnHelper.accessor('customerName', {
          id: 'customer',
          header: t('customer'),
          cell: (info) => info.getValue() || t('walkIn'),
        }),
        columnHelper.accessor((row) => row.startedAt ?? row.createdAt ?? '', {
          id: 'started',
          header: t('started'),
          cell: ({ row }) => {
            const start = row.original.startedAt ?? row.original.createdAt
            return start ? new Date(start).toLocaleString(locale) : '—'
          },
        }),
        columnHelper.accessor((row) => row.endedAt ?? '', {
          id: 'ended',
          header: t('ended'),
          cell: ({ row }) => {
            const end = row.original.endedAt
            return end
              ? new Date(end).toLocaleTimeString(locale, {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '—'
          },
        }),
        columnHelper.display({
          id: 'duration',
          header: t('duration'),
          cell: ({ row }) => {
            const start = row.original.startedAt
            const end = row.original.endedAt
            if (!start || !end) return '—'
            return (
              <span className='font-mono tabular-nums'>
                {formatDuration(start, end)}
              </span>
            )
          },
        }),
        // Rounded steps per rate, exactly what went on the bill
        columnHelper.display({
          id: 'rates',
          header: t('rateOptions'),
          cell: ({ row }) => (
            <span className='tabular-nums'>
              {stayBreakdown(row.original, t, localized) || '—'}
            </span>
          ),
        }),
        columnHelper.accessor((row) => Number(row.totalCost ?? 0), {
          meta: { align: 'end' },
          id: 'total',
          header: () => <div className='text-end'>{t('total')}</div>,
          cell: ({ row }) =>
            row.original.totalCost != null ? (
              <div className='text-end font-medium tabular-nums'>
                {formatEgp(row.original.totalCost)}
              </div>
            ) : (
              <div className='text-end'>—</div>
            ),
        }),
        columnHelper.display({
          id: 'paid',
          header: t('paid'),
          cell: ({ row }) => {
            const stay = row.original
            if (Number(stay.status) === STAY_CANCELLED) {
              return <Badge variant='destructive'>{t('cancelled')}</Badge>
            }
            return stay.paidAt ? (
              <Badge variant='secondary'>
                {stay.receiptNumber != null
                  ? `#${stay.receiptNumber}`
                  : t('paid')}
              </Badge>
            ) : (
              <Badge variant='outline'>{t('notPaid')}</Badge>
            )
          },
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
        />

        <DataTablePagination table={table} />
      </Main>
    </>
  )
}
