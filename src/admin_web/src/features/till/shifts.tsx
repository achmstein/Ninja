import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ShiftView } from '@/api/sales'
import {
  getClosedShiftsOptions,
  getCurrentShiftOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  useLanguage,
  useLocale,
  useT,
  type TranslateParams,
  type TranslationKey,
} from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  createAppColumnHelper,
  dataTableFeatures,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { Stat } from '@/components/stat-strip'
import { OverShortBadge } from './components/shift-report'
import { ShiftSheet } from './components/shift-sheet'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/shifts')

// The closed-shift list comes back as a bare page with no total, so paging
// is prev/next only, at the size the API defaults to
const PAGE_SIZE = 20

const columnHelper = createAppColumnHelper<ShiftView>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function getShiftColumns({ t, locale }: { t: Translate; locale: string }) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const at = (
    value: string | null | undefined,
    by: string | null | undefined
  ) =>
    value ? (
      <span>
        <span className='tabular-nums'>{dateTime.format(new Date(value))}</span>
        {by && <span className='text-muted-foreground text-xs'> · {by}</span>}
      </span>
    ) : (
      '—'
    )
  const money = (value: number | string | null | undefined) => (
    <div className='text-end tabular-nums'>{formatEgp(value)}</div>
  )

  return columnHelper.columns([
    columnHelper.accessor('id', {
      meta: { align: 'end' },
      id: 'id',
      header: t('shiftHash'),
      cell: (info) => (
        <span className='font-medium tabular-nums'>
          #{toNumber(info.getValue())}
        </span>
      ),
    }),
    // The verdict is what a reviewer scans for: it comes right after the number
    columnHelper.accessor('overShort', {
      id: 'overShort',
      header: t('overShort'),
      cell: (info) => <OverShortBadge value={toNumber(info.getValue())} />,
    }),
    columnHelper.accessor('openedAt', {
      id: 'openedAt',
      header: t('openedAt'),
      cell: (info) => at(info.getValue(), info.row.original.openedBy),
    }),
    columnHelper.accessor('closedAt', {
      id: 'closedAt',
      header: t('closedAt'),
      cell: (info) => at(info.getValue(), info.row.original.closedBy),
    }),
    columnHelper.accessor('ticketsSettled', {
      meta: { align: 'end' },
      id: 'tickets',
      header: () => <div className='text-end'>{t('posTicketsSettled')}</div>,
      cell: (info) => (
        <div className='text-end tabular-nums'>{toNumber(info.getValue())}</div>
      ),
    }),
    columnHelper.accessor('salesTotal', {
      id: 'sales',
      header: () => <div className='text-end'>{t('salesTotal')}</div>,
      cell: (info) => money(info.getValue()),
    }),
    columnHelper.accessor('expectedCash', {
      id: 'expected',
      header: () => <div className='text-end'>{t('expected')}</div>,
      cell: (info) => money(info.getValue()),
    }),
    columnHelper.accessor('closingCount', {
      id: 'counted',
      header: () => <div className='text-end'>{t('counted')}</div>,
      cell: (info) => money(info.getValue()),
    }),
  ])
}

/**
 * The drawer as the back office reads it: the open shift as a live X report,
 * and the Z reports of every closed one in the window. Nothing here opens,
 * moves or counts a drawer — that is the till's job.
 */
export function TillShifts() {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const page = search.page ?? 1
  const [selected, setSelected] = useState<ShiftView | null>(null)
  const { dayWindow, isAll, ready, fromIso, toIso } = useTillWindow(search, {
    defaultPreset: 'all',
  })

  // A 404 is the server's normal "no shift open" answer: never retried,
  // never a toast, just the empty line
  const current = useQuery({
    ...getCurrentShiftOptions({ query: { 'api-version': API_VERSION } }),
    retry: false,
    refetchInterval: 60_000,
  })
  const noOpenShift =
    current.isError &&
    current.error instanceof AxiosError &&
    current.error.response?.status === 404
  const shift = current.isError ? null : (current.data ?? null)

  const closed = useQuery({
    ...getClosedShiftsOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: page - 1,
        pageSize: PAGE_SIZE,
        from: isAll ? undefined : fromIso || undefined,
        to: isAll ? undefined : toIso || undefined,
      },
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(
    () => getShiftColumns({ t, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const rows = closed.data ?? []
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
  })

  const goTo = (next: number) =>
    navigate({
      search: (prev) => ({ ...prev, page: next <= 1 ? undefined : next }),
    })

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <>
      <TillPage
        tab='shifts'
        search={search}
        dayWindow={dayWindow}
        defaultPreset='all'
        onRangeChange={(next) =>
          navigate({
            search: (prev) => ({ ...prev, page: undefined, ...next }),
          })
        }
      >
        {/* The open shift, unboxed: its state, its one number, its report */}
        <section className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <span
              className={`size-2 rounded-full ${shift ? 'bg-success' : 'bg-muted-foreground/40'}`}
            />
            <h2 className='text-sm font-semibold'>{t('currentShift')}</h2>
            {shift && <Badge>{t('shiftOpenBadge')}</Badge>}
          </div>
          {current.isPending ? (
            <Skeleton className='h-16 w-64' />
          ) : shift ? (
            <div className='flex flex-wrap items-end justify-between gap-4'>
              <div className='flex flex-col gap-1'>
                <Stat
                  size='hero'
                  label={t('expectedInDrawer')}
                  value={formatEgp(shift.expectedInDrawer)}
                />
                <p className='text-muted-foreground text-sm'>
                  {shift.openedAt &&
                    `${t('openedAt')} ${dateTime.format(new Date(shift.openedAt))}`}
                  {shift.openedBy && ` · ${shift.openedBy}`}
                  {' · '}
                  {t('posTicketsCount', {
                    count: toNumber(shift.ticketsSettled),
                  })}
                  {' · '}
                  {t('salesTotal')} {formatEgp(shift.salesTotal)}
                </p>
              </div>
              <Button variant='outline' onClick={() => setSelected(shift)}>
                {t('viewReport')}
              </Button>
            </div>
          ) : noOpenShift ? (
            <p className='text-muted-foreground text-sm'>
              {t('noShiftOpen')} {t('noShiftOpenHint')}
            </p>
          ) : (
            <ErrorState
              className='py-6'
              error={current.error}
              onRetry={() => current.refetch()}
            />
          )}
        </section>

        <section className='flex flex-col gap-3'>
          <h2 className='text-sm font-semibold'>{t('closedShifts')}</h2>
          {closed.isError ? (
            <ErrorState error={closed.error} onRetry={() => closed.refetch()} />
          ) : (
            <>
              <DataTable
                table={table}
                isLoading={closed.isLoading}
                emptyMessage={t('noClosedShifts')}
                onRowClick={(row) => setSelected(row.original)}
              />
              <div className='flex items-center justify-end gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8'
                  disabled={page <= 1}
                  onClick={() => goTo(page - 1)}
                  aria-label={t('previousPage')}
                >
                  <ChevronLeft className='h-4 w-4 rtl:rotate-180' />
                </Button>
                <span className='text-sm tabular-nums'>{page}</span>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8'
                  disabled={rows.length < PAGE_SIZE}
                  onClick={() => goTo(page + 1)}
                  aria-label={t('nextPage')}
                >
                  <ChevronRight className='h-4 w-4 rtl:rotate-180' />
                </Button>
              </div>
            </>
          )}
        </section>
      </TillPage>

      <ShiftSheet
        shift={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </>
  )
}
