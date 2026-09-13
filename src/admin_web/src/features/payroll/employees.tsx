import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { KeyRound, UserPlus, Users } from 'lucide-react'
import { type EmployeeView } from '@/api/payroll'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { EmployeeSheet } from './components/employee-sheet'
import { payLabel } from './format'
import { employeesQueryOptions } from './queries'

const route = getRouteApi('/_authenticated/payroll/employees')
const columnHelper = createAppColumnHelper<EmployeeView>()

/**
 * The register: everyone who works at the branch, with their pay and what
 * they are owed. A row opens the employee's sheet; a login is a badge, not
 * a requirement — a runner has none.
 */
export function Employees() {
  const t = useT()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const showInactive = search.inactive === true

  const employees = useQuery(employeesQueryOptions(showInactive))

  const open = (employee?: number, isNew?: boolean) =>
    navigate({
      search: (prev) => ({
        ...prev,
        employee: employee ?? undefined,
        new: isNew || undefined,
      }),
    })

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: t('name'),
          cell: ({ row }) => (
            <div className='flex flex-col'>
              <span
                className={cn(
                  'font-medium',
                  !row.original.isActive && 'text-muted-foreground'
                )}
              >
                {row.original.name}
              </span>
              <span className='text-muted-foreground text-xs'>
                {row.original.jobTitle || '—'}
              </span>
            </div>
          ),
        }),
        columnHelper.display({
          id: 'pay',
          header: t('pay'),
          cell: ({ row }) => (
            <span className='tabular-nums'>
              {payLabel(row.original.currentTerms, t)}
            </span>
          ),
        }),
        columnHelper.accessor((row) => toNumber(row.balance), {
          id: 'balance',
          header: t('owed'),
          cell: ({ row }) => {
            const balance = toNumber(row.original.balance)
            return (
              <span
                className={cn(
                  'tabular-nums',
                  balance > 0 && 'font-medium',
                  balance < 0 && 'text-destructive'
                )}
              >
                {balance < 0
                  ? `${t('owesShort')} ${formatEgp(-balance)}`
                  : formatEgp(balance)}
              </span>
            )
          },
        }),
        columnHelper.display({
          id: 'status',
          header: '',
          cell: ({ row }) => (
            <div className='flex gap-1'>
              {row.original.userId && (
                <Badge variant='outline' className='gap-1 font-normal'>
                  <KeyRound className='h-3 w-3' />
                  {t('hasLogin')}
                </Badge>
              )}
              {!row.original.isActive && (
                <Badge variant='secondary' className='font-normal'>
                  {t('leftOn', { date: row.original.endedOn ?? '' })}
                </Badge>
              )}
            </div>
          ),
        }),
      ]),
    [t]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: employees.data ?? [],
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    // No pager: the register is one screen
    initialState: {
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  })

  return (
    <>
      <Main className='flex flex-col gap-6'>
        <PageHeader
          title={t('navPayrollEmployees')}
          description={t('employeesSubtitle')}
          actions={
            <Button onClick={() => open(undefined, true)}>
              <UserPlus className='me-2 h-4 w-4' />
              {t('addEmployee')}
            </Button>
          }
        >
          <label className='flex items-center gap-2 text-sm'>
            <Switch
              checked={showInactive}
              onCheckedChange={(checked) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    inactive: checked || undefined,
                  }),
                })
              }
            />
            {t('showFormerEmployees')}
          </label>
        </PageHeader>

        {employees.isError ? (
          <ErrorState error={employees.error} onRetry={employees.refetch} />
        ) : !employees.isLoading && (employees.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            title={t('noEmployees')}
            description={t('noEmployeesHint')}
            action={
              <Button onClick={() => open(undefined, true)}>
                <UserPlus className='me-2 h-4 w-4' />
                {t('addEmployee')}
              </Button>
            }
          />
        ) : (
          <DataTable
            table={table}
            isLoading={employees.isLoading}
            onRowClick={(row) => open(toNumber(row.original.id))}
          />
        )}
      </Main>

      <EmployeeSheet
        employeeId={search.employee ?? null}
        isNew={search.new === true}
        onClose={() => open()}
      />
    </>
  )
}
