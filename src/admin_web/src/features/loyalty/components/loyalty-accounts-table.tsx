import { useMemo } from 'react'
import { useTable } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import {
  createAppColumnHelper,
  DataTable,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { useLanguage, useLocale, useT } from '@/lib/i18n'
import {
  tierColors,
  type LoyaltyAccount,
  type LoyaltyTier,
} from '../types'
import { tierNameKeys } from './tier-name'

const columnHelper = createAppColumnHelper<LoyaltyAccount>()

interface LoyaltyAccountsTableProps {
  accounts: LoyaltyAccount[] | undefined
  isLoading: boolean
  onViewAccount: (account: LoyaltyAccount) => void
}

export function LoyaltyAccountsTable({
  accounts,
  isLoading,
  onViewAccount,
}: LoyaltyAccountsTableProps) {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)

  const tierFilterOptions = useMemo(
    () =>
      (['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map(
        (tier) => ({ label: t(tierNameKeys[tier]), value: tier })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor(
          (row) => row.userDisplayName || row.userId,
          {
            id: 'customer',
            header: t('customer'),
            enableSorting: false,
            cell: ({ row }) => (
              <div className='flex flex-col'>
                <span className='font-medium'>
                  {row.original.userDisplayName || t('customer')}
                </span>
                <span className='text-muted-foreground font-mono text-xs'>
                  {row.original.userId.slice(0, 8)}…
                </span>
              </div>
            ),
          }
        ),
        columnHelper.accessor('currentTier', {
          id: 'tier',
          header: t('tier'),
          enableSorting: false,
          filterFn: 'inArray',
          cell: ({ row }) => (
            <Badge
              variant='outline'
              className='gap-1.5'
            >
              <span
                className='h-2 w-2 rounded-full'
                style={{ backgroundColor: tierColors[row.original.currentTier] }}
              />
              {t(tierNameKeys[row.original.currentTier])}
            </Badge>
          ),
        }),
        columnHelper.accessor('pointsBalance', {
          id: 'balance',
          header: ({ column }) => (
            <div className='flex justify-end'>
              <DataTableColumnHeader
                column={column}
                title={t('balance')}
                className='-me-3'
              />
            </div>
          ),
          sortFn: 'basic',
          cell: ({ row }) => (
            <div className='text-end font-semibold tabular-nums'>
              {row.original.pointsBalance.toLocaleString(locale)} {t('points')}
            </div>
          ),
        }),
        columnHelper.accessor('lifetimePoints', {
          id: 'lifetime',
          header: ({ column }) => (
            <div className='flex justify-end'>
              <DataTableColumnHeader
                column={column}
                title={t('lifetimePoints')}
                className='-me-3'
              />
            </div>
          ),
          sortFn: 'basic',
          cell: ({ row }) => (
            <div className='text-muted-foreground text-end tabular-nums'>
              {row.original.lifetimePoints.toLocaleString(locale)} {t('points')}
            </div>
          ),
        }),
        columnHelper.accessor('createdAt', {
          id: 'joined',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('memberSince')} />
          ),
          sortFn: 'datetime',
          cell: ({ row }) =>
            new Date(row.original.createdAt).toLocaleDateString(locale),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: accounts ?? [],
    columns,
    getRowId: (row) => String(row.id),
    globalFilterFn: 'includesString',
    initialState: {
      sorting: [{ id: 'balance', desc: true }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  })

  return (
    <div className='flex flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder={t('searchByName')}
        filters={[
          { columnId: 'tier', title: t('tier'), options: tierFilterOptions },
        ]}
      />
      <DataTable
        table={table}
        isLoading={isLoading}
        emptyMessage={t('noLoyaltyAccounts')}
        onRowClick={(row) => onViewAccount(row.original)}
      />
      <DataTablePagination table={table} />
    </div>
  )
}
