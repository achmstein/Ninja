import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { type ReservationViewModel } from '@/api/spaces'
import {
  getReservationHistoryOptions,
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
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'
import {
  comparePlaces,
  RESERVATION_CANCELLED,
  RESERVATION_COMPLETED,
  RESERVATION_EXPIRED,
  RESERVATION_SEATED,
} from './status'

const route = getRouteApi('/_authenticated/places/reservations')

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

/** How a closed reservation ended, as a badge. */
export function ReservationOutcome({
  reservation,
}: {
  reservation: ReservationViewModel
}) {
  const t = useT()
  switch (Number(reservation.status)) {
    case RESERVATION_SEATED:
      return <StatusChip tone='success'>{t('seated')}</StatusChip>
    case RESERVATION_COMPLETED:
      return <StatusChip tone='success'>{t('completed')}</StatusChip>
    case RESERVATION_CANCELLED:
      return <StatusChip tone='muted'>{t('cancelled')}</StatusChip>
    case RESERVATION_EXPIRED:
      // The one an owner looks for: who booked and never came
      return <StatusChip tone='danger'>{t('noShow')}</StatusChip>
    default:
      return <StatusChip tone='info'>{t('held')}</StatusChip>
  }
}

const columnHelper = createAppColumnHelper<ReservationViewModel>()

/** Every seated, cancelled or lapsed reservation of the branch, by place and the day it was for. */
export function ReservationHistory() {
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

  // Any place can have been reserved; the filter lists them all
  const { data: places = [] } = useQuery(listPlacesOptions())
  const sortedPlaces = useMemo(
    () => [...places].sort(comparePlaces(localized)),
    [places, localized]
  )

  const historyQuery = useQuery({
    ...getReservationHistoryOptions({
      query: {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        placeId: search.place,
        fromDate,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const reservations = historyQuery.data?.items ?? []

  // The day and time it was for: a booking made ahead sits with the day it
  // was honoured (or missed), a reservation for now with the moment it was made
  const forOf = (r: ReservationViewModel) => r.for ?? r.createdAt

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('customerName', {
          id: 'customer',
          header: t('customer'),
          cell: ({ row }) => (
            <div className='flex flex-col leading-tight'>
              <span className='font-medium'>
                {row.original.customerName || t('walkIn')}
                {row.original.partySize ? (
                  <span className='text-muted-foreground font-normal'>
                    {' '}
                    · {t('partyOf', { count: row.original.partySize })}
                  </span>
                ) : null}
              </span>
              {localized(row.original.placeName) && (
                <span className='text-muted-foreground text-xs'>
                  {localized(row.original.placeName)}
                </span>
              )}
            </div>
          ),
        }),
        columnHelper.accessor((row) => forOf(row) ?? '', {
          id: 'for',
          header: t('reservedFor'),
          cell: ({ row }) => <When value={forOf(row.original)} mode='time' />,
        }),
        columnHelper.display({
          id: 'outcome',
          header: t('outcome'),
          cell: ({ row }) => {
            const at = row.original.seatedAt ?? row.original.closedAt
            return (
              <div className='flex items-center gap-2'>
                <ReservationOutcome reservation={row.original} />
                {at && (
                  <When
                    value={at}
                    mode='time'
                    className='text-muted-foreground text-xs'
                  />
                )}
              </div>
            )
          },
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: reservations,
    columns,
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
        <PageHeader back={{ to: '/places' }} title={t('reservationHistory')}>
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
                {sortedPlaces.map((place) => (
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
          emptyMessage={t('noReservationHistory')}
          groupBy={{
            key: (row) => dayKey(forOf(row)),
            label: (key) => dayHeading(key, locale, t),
          }}
          mobileRow={({ original: r }) => (
            <ListRow
              title={
                <>
                  {r.customerName || t('walkIn')}
                  {r.partySize ? (
                    <span className='text-muted-foreground font-normal'>
                      {' '}
                      · {t('partyOf', { count: r.partySize })}
                    </span>
                  ) : null}
                </>
              }
              meta={
                <>
                  <span>{localized(r.placeName) || '—'}</span>
                  <Dot />
                  <When value={forOf(r)} mode='time' />
                </>
              }
              trailingMeta={<ReservationOutcome reservation={r} />}
            />
          )}
        />

        <DataTablePagination table={table} />
      </Main>
    </>
  )
}
