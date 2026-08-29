import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { ArrowLeft } from 'lucide-react'
import { type ReservationViewModel } from '@/api/rooms'
import {
  getSessionHistoryOptions,
  listRoomsOptions,
} from '@/api/rooms/@tanstack/react-query.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  createAppColumnHelper,
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  useLanguage,
  useLocale,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import {
  formatBillingHours,
  formatDuration,
  sessionBilledHours,
  sessionStatusConfig,
  sessionStartTime,
} from './status'

const route = getRouteApi('/_authenticated/rooms/history')

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

const columnHelper = createAppColumnHelper<ReservationViewModel>()

export function SessionsHistory() {
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

  const { data: rooms = [] } = useQuery(
    listRoomsOptions()
  )

  const historyQuery = useQuery({
    ...getSessionHistoryOptions({
      query: {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        roomId: search.room,
        fromDate,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const sessions = historyQuery.data?.items ?? []

  const historyColumns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('id', {
          id: 'id',
          header: t('sessionNumber'),
          cell: (info) => (
            <span className='font-medium'>#{info.getValue()}</span>
          ),
        }),
        columnHelper.accessor((row) => localized(row.roomName), {
          id: 'room',
          header: t('room'),
          cell: ({ row }) => <span>{localized(row.original.roomName) || '—'}</span>,
        }),
        columnHelper.accessor('customerName', {
          id: 'customer',
          header: t('customer'),
          cell: (info) => info.getValue() || '—',
        }),
        columnHelper.accessor((row) => sessionStartTime(row) ?? '', {
          id: 'started',
          header: t('started'),
          cell: ({ row }) => {
            const start = sessionStartTime(row.original)
            return start ? new Date(start).toLocaleString(locale) : '—'
          },
        }),
        columnHelper.display({
          id: 'duration',
          header: t('duration'),
          cell: ({ row }) => {
            const start = row.original.actualStartTime
            const end = row.original.endTime
            if (!start || !end) return '—'
            return formatDuration(start, end)
          },
        }),
        // Rounded quarter-hour steps, exactly what gets entered into the POS
        columnHelper.accessor((row) => sessionBilledHours(row), {
          id: 'billedHours',
          header: () => <div className='text-end'>{t('billedHours')}</div>,
          cell: ({ row }) => {
            const hours = sessionBilledHours(row.original)
            return hours > 0 ? (
              <div className='text-end font-medium tabular-nums'>
                {formatBillingHours(hours, t)}
              </div>
            ) : (
              <div className='text-end'>—</div>
            )
          },
        }),
        columnHelper.accessor((row) => Number(row.status ?? 0), {
          id: 'status',
          header: t('status'),
          cell: ({ row }) => {
            const status =
              sessionStatusConfig[Number(row.original.status ?? 0)]
            return status ? (
              <Badge variant={status.variant}>{t(status.key)}</Badge>
            ) : null
          },
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: sessions,
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
      <Header />

      <Main className='flex flex-col gap-4'>
        <div className='flex items-center gap-2'>
          <Button size='icon' variant='ghost' className='-ms-2' asChild>
            <Link to='/rooms' aria-label={t('rooms')}>
              <ArrowLeft size={20} className='rtl:rotate-180' />
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('sessionHistory')}
            </h1>
            <p className='text-muted-foreground'>
              {t('sessionHistorySubtitle')}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Select
            value={search.room != null ? String(search.room) : 'all'}
            onValueChange={(value) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: undefined,
                  room: value === 'all' ? undefined : Number(value),
                }),
              })
            }
          >
            <SelectTrigger size='sm' className='h-8 w-[160px]'>
              <SelectValue placeholder={t('allRooms')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('allRooms')}</SelectItem>
              {rooms.map((room) => (
                <SelectItem key={String(room.id)} value={String(room.id)}>
                  {localized(room.name)}
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

        <DataTable
          table={table}
          isLoading={historyQuery.isLoading}
          emptyMessage={t('noCompletedSessions')}
        />

        <DataTablePagination table={table} />
      </Main>
    </>
  )
}
