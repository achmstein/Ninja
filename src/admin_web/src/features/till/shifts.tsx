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
  type AppRow,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { InfoTip } from '@/components/info-tip'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { Stat } from '@/components/stat-strip'
import { When } from '@/components/when'
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

/** When a shift ran, as one line: "Fri 3 Oct, 09:00 – 17:30" */
function ShiftSpan({ shift }: { shift: ShiftView }) {
  return (
    <span className='tabular-nums'>
      <When value={shift.openedAt} mode='dateTime' /> –{' '}
      <When value={shift.closedAt} mode='time' />
    </span>
  )
}

/** Who opened and closed it, once when the same person did both */
function shiftPeople(shift: ShiftView): string {
  const people = [shift.openedBy, shift.closedBy].filter(Boolean)
  return [...new Set(people)].join(' → ')
}

/**
 * A closed shift as the owner reviews it: when it ran and who ran it, how
 * much it sold (bills under it), and the drawer's verdict with what was
 * counted against what was expected under it. Over or short is the thing
 * to scan for.
 */
function getShiftColumns({ t }: { t: Translate }) {
  return columnHelper.columns([
    columnHelper.accessor('openedAt', {
      id: 'when',
      header: t('shiftHash'),
      cell: (info) => (
        <div className='flex flex-col leading-tight'>
          <span className='font-medium'>
            #{toNumber(info.row.original.id)}{' '}
            <span className='font-normal'>
              <ShiftSpan shift={info.row.original} />
            </span>
          </span>
          {shiftPeople(info.row.original) && (
            <span className='text-muted-foreground text-xs'>
              {shiftPeople(info.row.original)}
            </span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('salesTotal', {
      meta: { align: 'end' },
      id: 'sales',
      header: t('salesTotal'),
      cell: (info) => (
        <Money
          value={info.getValue()}
          strong
          sub={t('posTicketsCount', {
            count: toNumber(info.row.original.ticketsSettled),
          })}
        />
      ),
    }),
    columnHelper.accessor('overShort', {
      meta: { align: 'end' },
      id: 'overShort',
      header: t('overShort'),
      cell: (info) => (
        <div className='flex flex-col items-end gap-1'>
          <OverShortBadge value={toNumber(info.getValue())} />
          <span className='text-muted-foreground text-xs tabular-nums'>
            {formatEgp(info.row.original.closingCount)} /{' '}
            {formatEgp(info.row.original.expectedCash)}
          </span>
        </div>
      ),
    }),
  ])
}

function ShiftListRow({ row, t }: { row: AppRow<ShiftView>; t: Translate }) {
  const shift = row.original
  return (
    <ListRow
      title={<ShiftSpan shift={shift} />}
      meta={
        <>
          <span className='tabular-nums'>#{toNumber(shift.id)}</span>
          {shiftPeople(shift) && (
            <>
              <Dot />
              <span className='truncate'>{shiftPeople(shift)}</span>
            </>
          )}
          <Dot />
          {t('posTicketsCount', { count: toNumber(shift.ticketsSettled) })}
        </>
      }
      trailing={<Money value={shift.salesTotal} strong />}
      trailingMeta={<OverShortBadge value={toNumber(shift.overShort)} />}
    />
  )
}

/**
 * The drawer as the back office reads it: the open shift as a live X report,
 * and the Z reports of every closed one in the window. Nothing here opens,
 * moves or counts a drawer — that is the till's job.
 */
export function TillShifts() {
  const t = useT()
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
    () => getShiftColumns({ t }),
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
                  {shift.openedAt && (
                    <>
                      {t('openedAt')} <When value={shift.openedAt} />
                    </>
                  )}
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
            <p className='text-muted-foreground flex items-center gap-1 text-sm'>
              {t('noShiftOpen')}
              <InfoTip>{t('noShiftOpenHint')}</InfoTip>
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
                mobileRow={(row) => <ShiftListRow row={row} t={t} />}
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
