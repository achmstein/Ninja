import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { getRealmRoles } from '@/config/oidc-config'
import { Motorbike, ShieldCheck } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { type RiderOverview } from '@/api/ordering'
import { getRidersOverviewOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { EntityAvatar } from '@/components/entity-avatar'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'
import {
  compareRiders,
  num,
  presenceLabel,
  presenceOf,
  presenceTone,
} from './format'

const columnHelper = createAppColumnHelper<RiderOverview>()

/** Online, Quiet or Off, in words and colour; Quiet says why on hover */
export function PresenceChip({ status }: { status?: string | null }) {
  const t = useT()
  const presence = presenceOf(status)
  return (
    <StatusChip
      tone={presenceTone[presence]}
      className={cn(presence === 'Quiet' && 'cursor-help')}
    >
      <span title={presence === 'Quiet' ? t('riderQuietHint') : undefined}>
        {t(presenceLabel[presence])}
      </span>
    </StatusChip>
  )
}

/** When their app was last heard from, or that it never was */
export function LastSeen({ rider }: { rider: RiderOverview }) {
  const t = useT()
  return rider.lastSeenAt ? (
    <When value={rider.lastSeenAt} />
  ) : (
    <span className='text-muted-foreground'>{t('riderNeverSeen')}</span>
  )
}

/**
 * The branch's riders: who is working now (Online, Quiet, Off), what each
 * has out, and what they delivered and handed in today. Online first. Kept
 * live by the hub (a rider starting or stopping, a delivery moving) and a
 * minute's poll, since a rider going quiet raises no event. A row opens the
 * rider's own page.
 */
export function Riders() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const navigate = useNavigate()
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  // "Today" is the admin's own day: Ordering keeps no time zone
  const tzOffsetMinutes = new Date().getTimezoneOffset()
  const overview = useQuery({
    ...getRidersOverviewOptions({
      query: { 'api-version': API_VERSION, tzOffsetMinutes },
    }),
    refetchInterval: 60_000,
  })
  const riders = useMemo(
    () => [...(overview.data ?? [])].sort(compareRiders),
    [overview.data]
  )
  const online = riders.filter((r) => presenceOf(r.status) === 'Online').length

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: t('name'),
          cell: ({ row }) => (
            <div className='flex items-center gap-3'>
              <EntityAvatar name={row.original.name ?? ''} />
              <div className='flex flex-col leading-tight'>
                {/* A link as well as a row click, so the keyboard reaches the rider */}
                <Link
                  to='/riders/$userId'
                  params={{ userId: row.original.userId ?? '' }}
                  className='font-medium hover:underline'
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.original.name}
                </Link>
                {row.original.enabled === false && (
                  <span className='text-muted-foreground text-xs'>
                    {t('riderDisabled')}
                  </span>
                )}
              </div>
            </div>
          ),
        }),
        columnHelper.accessor('status', {
          header: t('status'),
          cell: ({ row }) => <PresenceChip status={row.original.status} />,
        }),
        columnHelper.accessor('lastSeenAt', {
          header: t('riderLastSeen'),
          cell: ({ row }) => <LastSeen rider={row.original} />,
        }),
        columnHelper.accessor((row) => num(row.out), {
          id: 'out',
          meta: { align: 'end' },
          header: t('riderOutNow'),
          cell: ({ getValue }) => (
            <span className='tabular-nums'>{getValue() || '—'}</span>
          ),
        }),
        columnHelper.accessor((row) => num(row.deliveredToday), {
          id: 'deliveredToday',
          meta: { align: 'end' },
          header: t('riderDeliveredToday'),
          cell: ({ row }) => (
            <span className='tabular-nums'>
              {num(row.original.deliveredToday)}
              {num(row.original.failedToday) > 0 && (
                <span className='text-destructive ms-2 text-xs'>
                  {t('riderFailedToday')}: {num(row.original.failedToday)}
                </span>
              )}
            </span>
          ),
        }),
        columnHelper.accessor((row) => num(row.cashCollectedToday), {
          id: 'cashToday',
          meta: { align: 'end' },
          header: t('riderCashToday'),
          cell: ({ row }) => (
            <Money value={row.original.cashCollectedToday} dashZero />
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: riders,
    columns,
    getRowId: (row) => row.userId ?? '',
    enableSorting: false,
    // No pager: a branch's riders are one screen
    initialState: {
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  })

  return (
    <Main>
      <PageHeader
        title={t('ridersNav')}
        description={t('ridersDescription')}
        badge={
          riders.length > 0 ? (
            <StatusChip tone={online > 0 ? 'success' : 'muted'}>
              {t('ridersOnlineCount', { n: online })}
            </StatusChip>
          ) : undefined
        }
      />

      {overview.isError ? (
        <ErrorState
          title={t('ridersLoadFailed')}
          error={overview.error}
          onRetry={overview.refetch}
        />
      ) : !overview.isLoading && riders.length === 0 ? (
        <EmptyState
          icon={Motorbike}
          title={t('ridersEmptyTitle')}
          description={t('ridersEmptyDescription')}
          action={
            isOwner ? (
              <Button asChild variant='outline'>
                <Link to='/staff'>
                  <ShieldCheck />
                  {t('ridersOpenStaff')}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          table={table}
          isLoading={overview.isLoading}
          onRowClick={(row) =>
            navigate({
              to: '/riders/$userId',
              params: { userId: row.original.userId ?? '' },
            })
          }
          mobileRow={({ original: rider }) => (
            <ListRow
              leading={<EntityAvatar name={rider.name ?? ''} />}
              title={rider.name}
              meta={
                <>
                  <LastSeen rider={rider} />
                  {num(rider.out) > 0 && (
                    <>
                      <Dot />
                      <span className='tabular-nums'>
                        {t('riderOutNow')}: {num(rider.out)}
                      </span>
                    </>
                  )}
                  {rider.enabled === false && (
                    <>
                      <Dot />
                      <span>{t('riderDisabled')}</span>
                    </>
                  )}
                </>
              }
              trailing={<PresenceChip status={rider.status} />}
              trailingMeta={
                <span className='tabular-nums'>
                  {t('riderDeliveredToday')}: {num(rider.deliveredToday)}
                </span>
              }
            />
          )}
        />
      )}
    </Main>
  )
}
